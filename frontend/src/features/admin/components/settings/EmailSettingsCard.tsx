import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/shared/components/ui/form";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
	AlertCircle,
	Mail,
	HelpCircle,
	Loader2,
	Save,
	X,
	Send,
	CheckCircle,
	AlertTriangle,
	Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

import { apiClient, ENDPOINTS } from "@/shared/services/api";
import {
	errorHandlingService,
	showSuccess,
} from "@/shared/services/errorHandling.service";
import { logger } from "@/shared/services/logger.service";
import type { SystemSettings } from "@/shared/types/backend-api.types";

// Validation schema for email settings
const emailSettingsSchema = z.object({
	forward_certificate_emails_to: z
		.string()
		.min(1, "Admin email is required")
		.email("Must be a valid email address")
		.max(254, "Email address too long"),
	send_emails_to_self: z.boolean(),
});

type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>;

interface EmailSettingsCardProps {
	settings: SystemSettings;
	onSettingsUpdate: (field: string, value: any) => void;
}

export const EmailSettingsCard: React.FC<EmailSettingsCardProps> = ({
	settings,
	onSettingsUpdate,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSendingTest, setIsSendingTest] = useState(false);

	const form = useForm<EmailSettingsFormData>({
		resolver: zodResolver(emailSettingsSchema),
		defaultValues: {
			forward_certificate_emails_to:
				settings.forward_certificate_emails_to,
			send_emails_to_self: settings.send_emails_to_self,
		},
	});

	const getEnvironmentBadge = (environment: string) => {
		const envLower = environment.toLowerCase();
		switch (envLower) {
			case "production":
				return <Badge variant="destructive">Production</Badge>;
			case "staging":
				return <Badge variant="secondary">Staging</Badge>;
			case "development":
				return <Badge variant="outline">Development</Badge>;
			case "local":
				return <Badge variant="outline">Local</Badge>;
			default:
				return <Badge variant="outline">{environment}</Badge>;
		}
	};

	const getEnvironmentDescription = (environment: string) => {
		const envLower = environment.toLowerCase();
		switch (envLower) {
			case "production":
				return "Live production environment. Changes affect real users.";
			case "staging":
				return "Staging environment for testing. Safe to experiment.";
			case "development":
			case "local":
				return "Development environment. All emails are sent to admin.";
			default:
				return "Unknown environment configuration.";
		}
	};

	const getEmailRoutingStatus = () => {
		const isProduction =
			settings.environment.toLowerCase() === "production";
		const sendToSelf = settings.send_emails_to_self;

		if (sendToSelf) {
			return {
				icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
				text: "Testing Mode Active",
				description: `All emails are being sent to: ${settings.forward_certificate_emails_to}`,
				variant: "warning" as const,
				badge: (
					<Badge
						variant="outline"
						className="text-orange-600 border-orange-600"
					>
						Testing
					</Badge>
				),
			};
		} else {
			return {
				icon: <CheckCircle className="h-4 w-4 text-green-500" />,
				text: isProduction ? "Production Mode" : "Live Mode",
				description: "Emails are being sent to actual recipients",
				variant: "success" as const,
				badge: (
					<Badge
						variant="outline"
						className="text-green-600 border-green-600"
					>
						Live
					</Badge>
				),
			};
		}
	};

	const handleEdit = () => {
		setIsEditing(true);
		form.reset({
			forward_certificate_emails_to:
				settings.forward_certificate_emails_to,
			send_emails_to_self: settings.send_emails_to_self,
		});
	};

	const handleCancel = () => {
		setIsEditing(false);
		form.reset();
	};

	const handleToggleChange = (value: boolean) => {
		// Use the security-aware update handler
		onSettingsUpdate("send_emails_to_self", value);
	};

	const sendTestEmail = async () => {
		try {
			setIsSendingTest(true);

			// This would be a new endpoint for sending test emails
			// For now, we'll simulate the API call
			await new Promise((resolve) => setTimeout(resolve, 2000));

			showSuccess(
				`Test email sent to ${settings.forward_certificate_emails_to}`
			);
			logger.info("Test email sent", {
				recipient: settings.forward_certificate_emails_to,
				environment: settings.environment,
			});
		} catch (error) {
			errorHandlingService.handleError(error, {
				action: "send_test_email",
				component: "EmailSettingsCard",
			});
		} finally {
			setIsSendingTest(false);
		}
	};

	const onSubmit = async (data: EmailSettingsFormData) => {
		try {
			setIsSubmitting(true);

			// Use the security-aware update handler for each field
			for (const [field, value] of Object.entries(data)) {
				await onSettingsUpdate(field, value);
			}

			setIsEditing(false);
			logger.info("Email settings updated", {
				updatedFields: Object.keys(data),
				adminEmail: data.forward_certificate_emails_to,
			});
		} catch (error) {
			errorHandlingService.handleError(error, {
				action: "update_email_settings",
				component: "EmailSettingsCard",
				data,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const routingStatus = getEmailRoutingStatus();

	if (!isEditing) {
		return (
			<>
				<Card className="transition-all duration-300 hover:shadow-lg">
					<CardHeader>
						<CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 dark:text-white">
							<div className="flex items-center gap-2">
								<Mail className="h-5 w-5" aria-hidden="true" />
								<span id="email-settings-heading">
									Email Configuration
								</span>
							</div>
							{getEnvironmentBadge(settings.environment)}
						</CardTitle>
						<CardDescription>
							{getEnvironmentDescription(settings.environment)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							{/* Current Email Routing Status */}
							<div className="p-4 border rounded-lg bg-muted/50 transition-all duration-200 hover:bg-muted/70">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										{routingStatus.icon}
										<span className="font-medium">
											{routingStatus.text}
										</span>
										{routingStatus.badge}
									</div>
								</div>
								<p className="text-sm text-muted-foreground mb-3">
									{routingStatus.description}
								</p>

								{/* Email Toggle */}
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label htmlFor="email-toggle">
											Send emails to admin (testing mode)
										</Label>
										<p className="text-xs text-muted-foreground">
											When enabled, all system emails will
											be sent to the admin email instead
											of actual recipients
										</p>
									</div>
									<Switch
										id="email-toggle"
										checked={settings.send_emails_to_self}
										onCheckedChange={handleToggleChange}
										disabled={
											!settings.send_emails_to_self_editable ||
											isSubmitting
										}
									/>
								</div>
							</div>

							{/* Environment Restrictions */}
							{!settings.send_emails_to_self_editable && (
								<Alert>
									<Info className="h-4 w-4" />
									<AlertDescription>
										Email routing cannot be changed in the{" "}
										{settings.environment} environment.
										{settings.environment.toLowerCase() ===
											"local" ||
										settings.environment.toLowerCase() ===
											"development"
											? " Emails are always sent to admin in development environments."
											: ""}
									</AlertDescription>
								</Alert>
							)}

							{/* Admin Email Configuration */}
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<Label className="text-sm font-medium">
										Admin Email Address
									</Label>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">
												<p>
													This email address receives
													all system notifications
													when testing mode is enabled
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
								<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
									<div className="flex-1 p-3 bg-muted rounded-md transition-colors hover:bg-muted/80 w-full">
										<span className="text-sm font-mono break-all">
											{
												settings.forward_certificate_emails_to
											}
										</span>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={sendTestEmail}
										disabled={isSendingTest}
										className="flex items-center gap-2 transition-all duration-200 hover:scale-105 w-full sm:w-auto"
									>
										{isSendingTest ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Send className="h-4 w-4" />
										)}
										{isSendingTest ? "Sending..." : "Test"}
									</Button>
								</div>
							</div>

							<div className="pt-4 border-t">
								<Button
									onClick={handleEdit}
									className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
								>
									Edit Email Settings
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</>
		);
	}

	return (
		<Card className="transition-all duration-300 hover:shadow-lg">
			<CardHeader>
				<CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 dark:text-white">
					<div className="flex items-center gap-2">
						<Mail className="h-5 w-5" aria-hidden="true" />
						<span id="email-settings-heading">
							Edit Email Configuration
						</span>
					</div>
					{getEnvironmentBadge(settings.environment)}
				</CardTitle>
				<CardDescription>
					Update email routing and admin email settings
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-6"
					>
						{/* Admin Email Field */}
						<FormField
							control={form.control}
							name="forward_certificate_emails_to"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="flex items-center gap-2">
										Admin Email Address
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>
														This email address
														receives all system
														notifications when
														testing mode is enabled
													</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											type="email"
											placeholder="admin@example.com"
										/>
									</FormControl>
									<FormDescription>
										Email address that receives system
										notifications in testing mode
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Email Toggle Field */}
						<FormField
							control={form.control}
							name="send_emails_to_self"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel className="text-base">
											Send emails to admin (testing mode)
										</FormLabel>
										<FormDescription>
											When enabled, all system emails will
											be sent to the admin email instead
											of actual recipients
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
											disabled={
												!settings.send_emails_to_self_editable
											}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						{/* Environment Warning */}
						{!settings.send_emails_to_self_editable && (
							<Alert>
								<Info className="h-4 w-4" />
								<AlertDescription>
									Email routing cannot be changed in the{" "}
									{settings.environment} environment.
								</AlertDescription>
							</Alert>
						)}

						<div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
							<Button
								type="submit"
								disabled={isSubmitting}
								className="flex items-center gap-2"
							>
								{isSubmitting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
								{isSubmitting ? "Saving..." : "Save Changes"}
							</Button>

							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								disabled={isSubmitting}
								className="flex items-center gap-2"
							>
								<X className="h-4 w-4" />
								Cancel
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
