import React, { useState, useEffect } from "react";
import { AlertCircle, Settings, Shield, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { logger } from "@/shared/services/logger.service";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { securityService } from "@/features/admin/services/security.service";
import { settingsNotificationService } from "@/features/admin/services/settingsNotification.service";
import { useSystemSettings } from "@/features/admin/hooks/useSystemSettings";
import ConfirmationDialog from "@/features/admin/components/settings/ConfirmationDialog";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";

// Import loading skeletons
import { AdminPageSkeleton } from "@/features/admin/components/settings/LoadingSkeletons";

import type { SystemSettings } from "@/shared/types/backend-api.types";
import {
	PricingSettingsCard,
	EmailSettingsCard,
	SystemInfoCard,
} from "@/features/admin";

const AdminPage: React.FC = () => {
	const [pendingChanges, setPendingChanges] = useState<Record<string, any>>(
		{}
	);
	const [showConfirmation, setShowConfirmation] = useState(false);

	const { user } = useAuth();

	// Use the new settings hook
	const {
		settings,
		isLoading: loading,
		isUpdating,
		error,
		validationErrors,
		updateSettings,
		clearError,
		cacheStatus,
	} = useSystemSettings({
		autoLoad: true,
		enableChangeNotifications: true,
		onSettingsChange: (notification) => {
			// Handle settings change notifications
			if (settings) {
				settingsNotificationService.handleSettingsChange(
					notification,
					settings.environment,
					settings
				);
			}
		},
		onError: (errorMessage) => {
			logger.error("Settings hook error", { error: errorMessage });
		},
	});

	useEffect(() => {
		// Check admin access on component mount
		const accessCheck = securityService.checkAdminAccess(user);
		if (!accessCheck.allowed) {
			securityService.logSecurityEvent("access_denied", {
				userId: user?.id,
				reason: accessCheck.reason,
				component: "AdminPage",
			});
		}
	}, [user]);

	const handleSettingsUpdate = async (field: string, value: any) => {
		if (!settings || !user) return;

		// Clear any previous errors
		clearError();

		// Check admin access
		const accessCheck = securityService.checkAdminAccess(user);
		if (!accessCheck.allowed) {
			settingsNotificationService.showUpdateError(
				accessCheck.reason || "Access denied",
				[field],
				settings.environment
			);
			return;
		}

		// Prepare changes for security check
		const changes = [
			{
				field,
				oldValue: String(settings[field as keyof SystemSettings] || ""),
				newValue: String(value),
			},
		];

		// Check if confirmation is required
		const confirmationCheck = securityService.requiresConfirmation(
			changes,
			settings.environment
		);

		if (confirmationCheck.requiresConfirmation) {
			setPendingChanges({ [field]: value });
			setShowConfirmation(true);
			securityService.logSecurityEvent("confirmation_required", {
				userId: user.id,
				field,
				environment: settings.environment,
				confirmationLevel: confirmationCheck.confirmationLevel,
			});
			return;
		}

		// Apply changes directly if no confirmation needed
		await applySettingsChanges({ [field]: value });
	};

	const applySettingsChanges = async (changes: Record<string, any>) => {
		if (!settings || !user) return;

		const success = await updateSettings(changes);

		if (success) {
			// Show success notification
			settingsNotificationService.showUpdateSuccess(
				Object.keys(changes),
				settings.environment,
				settings.last_modified_by || undefined
			);

			// Clear pending changes and close confirmation
			setPendingChanges({});
			setShowConfirmation(false);

			// Log successful changes
			securityService.logSecurityEvent("settings_modified", {
				userId: user.id,
				changes: Object.keys(changes),
				environment: settings.environment,
			});
		} else {
			// Show error notification
			if (Object.keys(validationErrors).length > 0) {
				settingsNotificationService.showValidationError(
					validationErrors,
					settings.environment
				);
			} else if (error) {
				settingsNotificationService.showUpdateError(
					error,
					Object.keys(changes),
					settings.environment
				);
			}
		}
	};

	const handleConfirmChanges = () => {
		applySettingsChanges(pendingChanges);
	};

	const handleCancelChanges = () => {
		setPendingChanges({});
		setShowConfirmation(false);
	};

	// Breadcrumb configuration
	const breadcrumbs: BreadcrumbItem[] = [
		{
			label: "System Administration",
			current: true,
		},
	];

	// Check admin access
	const accessCheck = securityService.checkAdminAccess(user);
	if (!accessCheck.allowed) {
		return (
			<ContentLayout breadcrumbs={breadcrumbs} title="Admin">
				<Alert variant="destructive">
					<Shield className="h-4 w-4" />
					<AlertDescription>
						{accessCheck.reason ||
							"You don't have permission to access admin settings."}
					</AlertDescription>
				</Alert>
			</ContentLayout>
		);
	}

	if (loading) {
		return <AdminPageSkeleton />;
	}

	if (!settings && error) {
		return (
			<ContentLayout
				breadcrumbs={breadcrumbs}
				title="Admin"
				header={
					<div className="flex items-center gap-3">
						<Settings className="h-6 w-6" />
						<h1 className="text-2xl font-bold">Admin Settings</h1>
					</div>
				}
			>
				<div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
					<Alert
						variant={
							cacheStatus.isRateLimited
								? "destructive"
								: "default"
						}
						className="transition-all duration-300"
					>
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							{cacheStatus.isRateLimited
								? `Rate limited: ${error}. Please wait before refreshing.`
								: `Failed to load system settings: ${error}`}
						</AlertDescription>
					</Alert>
				</div>
			</ContentLayout>
		);
	}

	if (!settings) {
		return (
			<ContentLayout breadcrumbs={breadcrumbs} title="Admin">
				<div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
					<Alert className="transition-all duration-300">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Failed to load system settings. Please refresh the
							page.
						</AlertDescription>
					</Alert>
				</div>
			</ContentLayout>
		);
	}

	// Prepare confirmation dialog data
	const confirmationChanges = Object.entries(pendingChanges).map(
		([field, newValue]) => ({
			field: securityService.formatFieldName(field),
			oldValue: securityService.formatValue(
				field,
				String(settings[field as keyof SystemSettings] || "")
			),
			newValue: securityService.formatValue(field, String(newValue)),
		})
	);

	const confirmationConfig = securityService.getConfirmationConfig(
		confirmationChanges.map((_change) => ({
			field: Object.keys(pendingChanges)[0], // Use actual field name for security check
			oldValue: String(
				settings[
					Object.keys(pendingChanges)[0] as keyof SystemSettings
				] || ""
			),
			newValue: String(Object.values(pendingChanges)[0]),
		})),
		settings.environment
	);

	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			title="Admin"
			className="space-y-6"
			// header={
			// 	<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in-50 slide-in-from-top-4 duration-500">
			// 		<div className="flex items-center gap-3">
			// 			<Settings className="h-6 w-6" aria-hidden="true" />
			// 			<h1 className="text-2xl font-bold">Admin Settings</h1>
			// 		</div>

			// 		<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
			// 			{/* Rate limit status */}
			// 			{cacheStatus.isRateLimited && (
			// 				<Alert
			// 					className="w-full sm:w-auto transition-all duration-300"
			// 					role="alert"
			// 					aria-live="polite"
			// 				>
			// 					<Clock className="h-4 w-4" aria-hidden="true" />
			// 					<AlertDescription>
			// 						Rate limited - please wait before refreshing
			// 					</AlertDescription>
			// 				</Alert>
			// 			)}
			// 		</div>
			// 	</div>
			// }
		>
			{/* Settings cards with staggered animations */}
			<main
				className="space-y-6"
				role="region"
				aria-label="Settings sections"
			>
				{/* System Information */}
				<section
					className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500 delay-100"
					aria-labelledby="system-info-heading"
				>
					<SystemInfoCard
						settings={settings}
						onSettingsUpdate={() => {}} // SystemInfoCard is read-only
					/>
				</section>

				{/* Email Settings */}
				<section
					className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500 delay-200"
					aria-labelledby="email-settings-heading"
				>
					<EmailSettingsCard
						settings={settings}
						onSettingsUpdate={handleSettingsUpdate}
					/>
				</section>

				{/* Pricing Settings */}
				<section
					className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500 delay-300"
					aria-labelledby="pricing-settings-heading"
				>
					<PricingSettingsCard
						settings={settings}
						onSettingsUpdate={handleSettingsUpdate}
					/>
				</section>
			</main>

			{/* Confirmation Dialog */}
			<ConfirmationDialog
				isOpen={showConfirmation}
				onClose={handleCancelChanges}
				onConfirm={handleConfirmChanges}
				title={confirmationConfig.title}
				description={confirmationConfig.description}
				variant={confirmationConfig.variant}
				confirmText={confirmationConfig.confirmText}
				environment={settings.environment}
				isLoading={isUpdating}
				changes={confirmationChanges}
			/>
		</ContentLayout>
	);
};

export default AdminPage;
