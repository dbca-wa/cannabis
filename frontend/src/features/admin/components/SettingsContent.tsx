import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { PageTransition } from "@/shared/components/PageTransition";
import {
	FlaskConical,
	Package,
	Phone,
	DollarSign,
	Fuel,
	Percent,
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSystemSettings } from "@/features/admin/hooks/useSystemSettings";
import { securityService } from "@/features/admin/services/security.service";
import { settingsNotificationService } from "@/features/admin/services/settingsNotification.service";
import ConfirmationDialog from "@/features/admin/components/settings/ConfirmationDialog";
import { logger } from "@/shared/services/logger.service";

import type { SystemSettings } from "@/shared/types/backend-api.types";
import type { SystemSettingsUpdateRequest } from "@/features/admin/types/settings.types";
import type { LucideIcon } from "lucide-react";

interface RateType {
	key: keyof SystemSettingsUpdateRequest;
	label: string;
	description: string;
	prefix: string;
	suffix?: string;
	decimals: number;
	icon: LucideIcon;
	color: string;
}

const RATE_TYPES: RateType[] = [
	{
		key: "cost_per_certificate",
		label: "Certificate Cost",
		description: "Charged per certificate generated",
		prefix: "$",
		decimals: 2,
		icon: FlaskConical,
		color: "from-emerald-500 to-teal-500",
	},
	{
		key: "cost_per_bag",
		label: "Bag Identification",
		description: "Per bag examined",
		prefix: "$",
		decimals: 2,
		icon: Package,
		color: "from-blue-500 to-indigo-500",
	},
	{
		key: "call_out_fee",
		label: "Call-Out Fee",
		description: "Fixed fee per assessment appointment",
		prefix: "$",
		decimals: 2,
		icon: Phone,
		color: "from-violet-500 to-purple-500",
	},
	{
		key: "cost_per_forensic_hour",
		label: "Forensic Hour",
		description: "Hourly rate for botanist work",
		prefix: "$",
		decimals: 2,
		icon: DollarSign,
		color: "from-amber-500 to-orange-500",
	},
	{
		key: "cost_per_kilometer_fuel",
		label: "Fuel per KM",
		description: "Travel reimbursement rate",
		prefix: "$",
		decimals: 2,
		icon: Fuel,
		color: "from-rose-500 to-red-500",
	},
	{
		key: "tax_percentage",
		label: "Tax Percentage",
		description: "GST applied to invoices",
		prefix: "",
		suffix: "%",
		decimals: 0,
		icon: Percent,
		color: "from-cyan-500 to-sky-500",
	},
];

const SettingsContent = () => {
	const { user } = useAuth();

	const {
		settings,
		isUpdating,
		error,
		validationErrors,
		updateSettings,
		clearError,
	} = useSystemSettings({
		autoLoad: true,
		enableChangeNotifications: true,
		onSettingsChange: (notification) => {
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

	// Edit dialog state
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");

	// Confirmation dialog state
	const [pendingChanges, setPendingChanges] = useState<Record<string, string>>(
		{}
	);
	const [showConfirmation, setShowConfirmation] = useState(false);

	const applySettingsChanges = useCallback(
		async (changes: Record<string, string>) => {
			if (!settings || !user) return;

			const success = await updateSettings(
				changes as SystemSettingsUpdateRequest
			);

			if (success) {
				settingsNotificationService.showUpdateSuccess(
					Object.keys(changes),
					settings.environment,
					settings.last_modified_by || undefined
				);
				setPendingChanges({});
				setShowConfirmation(false);
				securityService.logSecurityEvent("settings_modified", {
					userId: user.id,
					changes: Object.keys(changes),
					environment: settings.environment,
				});
			} else {
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
		},
		[settings, user, updateSettings, validationErrors, error]
	);

	const handleSettingsUpdate = useCallback(
		async (field: string, value: string) => {
			if (!settings || !user) return;
			clearError();

			const accessCheck = securityService.checkAdminAccess(user);
			if (!accessCheck.allowed) {
				settingsNotificationService.showUpdateError(
					accessCheck.reason || "Access denied",
					[field],
					settings.environment
				);
				return;
			}

			const changes = [
				{
					field,
					oldValue: String(settings[field as keyof SystemSettings] || ""),
					newValue: value,
				},
			];

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

			await applySettingsChanges({ [field]: value });
		},
		[settings, user, clearError, applySettingsChanges]
	);

	const handleConfirmChanges = useCallback(() => {
		applySettingsChanges(pendingChanges);
	}, [applySettingsChanges, pendingChanges]);

	const handleCancelChanges = useCallback(() => {
		setPendingChanges({});
		setShowConfirmation(false);
	}, []);

	const openEdit = (index: number) => {
		if (!settings) return;
		const rate = RATE_TYPES[index];
		const currentValue = settings[rate.key as keyof SystemSettings];
		setEditingIndex(index);
		setEditValue(String(currentValue ?? ""));
	};

	const saveEdit = () => {
		if (editingIndex === null || !settings) return;
		const rate = RATE_TYPES[editingIndex];
		const parsed = parseFloat(editValue);
		if (isNaN(parsed)) return;
		handleSettingsUpdate(rate.key, editValue);
		setEditingIndex(null);
	};

	if (!settings)
		return (
			<div className="p-6 text-muted-foreground text-sm">
				Loading settings...
			</div>
		);

	const confirmationChanges = Object.entries(pendingChanges).map(
		([field, newValue]) => ({
			field: securityService.formatFieldName(field),
			oldValue: securityService.formatValue(
				field,
				String(settings[field as keyof SystemSettings] || "")
			),
			newValue: securityService.formatValue(field, newValue),
		})
	);

	const confirmationConfig = securityService.getConfirmationConfig(
		Object.entries(pendingChanges).map(([field, newValue]) => ({
			field,
			oldValue: String(settings[field as keyof SystemSettings] || ""),
			newValue,
		})),
		settings.environment
	);

	return (
		<PageTransition>
			<div className="space-y-4">
				{/* Pricing configuration */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-5">
						<div>
							<h3>Pricing configuration</h3>
							<p className="text-[13px] text-muted-foreground">
								Rates applied when generating invoices and certificates.
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{RATE_TYPES.map((rate, i) => {
							const Icon = rate.icon;
							const rawValue = settings[rate.key as keyof SystemSettings];
							const numValue = parseFloat(String(rawValue ?? "0"));
							const displayValue = isNaN(numValue)
								? "0"
								: numValue.toFixed(rate.decimals);

							return (
								<motion.div
									key={rate.key}
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: i * 0.03 }}
								>
									<div
										onClick={() => openEdit(i)}
										className="p-4 rounded-xl border border-border/70 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer group relative overflow-hidden"
									>
										<div
											className={`absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br ${rate.color} opacity-[0.08] blur-xl group-hover:opacity-[0.15] transition-opacity`}
										/>
										<div className="flex items-start gap-3 relative">
											<div
												className={`w-10 h-10 rounded-lg bg-gradient-to-br ${rate.color} text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200`}
											>
												<Icon className="w-5 h-5" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="text-[13px]">{rate.label}</div>
												<div className="text-[11px] text-muted-foreground truncate">
													{rate.description}
												</div>
												<div className="mt-2 tabular-nums tracking-tight text-[22px]">
													{rate.prefix}
													{displayValue}
													{rate.suffix || ""}
												</div>
											</div>
										</div>
									</div>
								</motion.div>
							);
						})}
					</div>
				</Card>
			</div>

			{/* Edit pricing dialog */}
			<Dialog
				open={editingIndex !== null}
				onOpenChange={(open) => !open && setEditingIndex(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Update {editingIndex !== null && RATE_TYPES[editingIndex].label}
						</DialogTitle>
					</DialogHeader>
					<div>
						<Label>Value</Label>
						<Input
							type="number"
							step="0.01"
							className="mt-1.5"
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							className="cursor-pointer"
							onClick={() => setEditingIndex(null)}
						>
							Cancel
						</Button>
						<Button
							className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
							onClick={saveEdit}
							disabled={isUpdating}
						>
							{isUpdating ? "Saving…" : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Security confirmation dialog */}
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
		</PageTransition>
	);
};

export default SettingsContent;
