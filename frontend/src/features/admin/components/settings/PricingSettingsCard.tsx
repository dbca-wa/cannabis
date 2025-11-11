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
	DollarSign,
	HelpCircle,
	Loader2,
	Save,
	X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import {
	errorHandlingService,
	showSuccess,
} from "@/shared/services/errorHandling.service";
import { logger } from "@/shared/services/logger.service";
import type { SystemSettings } from "@/shared/types/backend-api.types";

// Simple validation schema
const pricingSchema = z.object({
	cost_per_certificate: z.string().min(1, "Certificate cost is required"),
	cost_per_bag: z.string().min(1, "Bag cost is required"),
	call_out_fee: z.string().min(1, "Call out fee is required"),
	cost_per_forensic_hour: z.string().min(1, "Forensic hour cost is required"),
	cost_per_kilometer_fuel: z.string().min(1, "Fuel cost is required"),
	tax_percentage: z.string().min(1, "Tax percentage is required"),
});

type PricingFormData = z.infer<typeof pricingSchema>;

interface PricingSettingsCardProps {
	settings: SystemSettings;
	onSettingsUpdate: (field: string, value: any) => void;
}

// Currency formatting is now handled by validation utilities

// Field configuration
const fieldConfig = {
	cost_per_certificate: {
		label: "Certificate Cost",
		description: "Cost charged per certificate generated",
		helpText: "This is the base cost for generating a certificate.",
		placeholder: "110.00",
		prefix: "$",
		suffix: undefined,
	},
	cost_per_bag: {
		label: "Bag Identification Cost",
		description: "Cost charged per bag identification",
		helpText: "Cost for identifying and processing each evidence bag.",
		placeholder: "11.00",
		prefix: "$",
		suffix: undefined,
	},
	call_out_fee: {
		label: "Call Out Fee",
		description: "Fixed fee for call outs",
		helpText: "One-time fee charged for call out.",
		placeholder: "200.00",
		prefix: "$",
		suffix: undefined,
	},
	cost_per_forensic_hour: {
		label: "Forensic Hour Cost",
		description: "Cost charged per hour of forensic analysis",
		helpText: "Hourly rate for detailed forensic analysis work.",
		placeholder: "150.00",
		prefix: "$",
		suffix: undefined,
	},
	cost_per_kilometer_fuel: {
		label: "Fuel Cost per Kilometer",
		description: "Cost charged per kilometer for travel",
		helpText: "Rate per kilometer for travel expenses.",
		placeholder: "1.750",
		prefix: "$",
		suffix: undefined,
	},
	tax_percentage: {
		label: "Tax Percentage",
		description: "Tax rate applied to all charges",
		helpText: "Percentage rate for applicable taxes (GST, etc.).",
		placeholder: "10.00",
		prefix: undefined,
		suffix: "%",
	},
};

export const PricingSettingsCard: React.FC<PricingSettingsCardProps> = ({
	settings,
	onSettingsUpdate,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<PricingFormData>({
		resolver: zodResolver(pricingSchema),
		defaultValues: {
			cost_per_certificate: settings.cost_per_certificate,
			cost_per_bag: settings.cost_per_bag,
			call_out_fee: settings.call_out_fee,
			cost_per_forensic_hour: settings.cost_per_forensic_hour,
			cost_per_kilometer_fuel: settings.cost_per_kilometer_fuel,
			tax_percentage: settings.tax_percentage,
		},
	});

	const handleEdit = () => {
		setIsEditing(true);
		// Reset form with current values
		form.reset({
			cost_per_certificate: settings.cost_per_certificate,
			cost_per_bag: settings.cost_per_bag,
			call_out_fee: settings.call_out_fee,
			cost_per_forensic_hour: settings.cost_per_forensic_hour,
			cost_per_kilometer_fuel: settings.cost_per_kilometer_fuel,
			tax_percentage: settings.tax_percentage,
		});
	};

	const handleCancel = () => {
		setIsEditing(false);
		form.reset();
	};

	const onSubmit = async (data: PricingFormData) => {
		try {
			setIsSubmitting(true);

			// Use the security-aware update handler for each field
			for (const [field, value] of Object.entries(data)) {
				await onSettingsUpdate(field, value);
			}

			setIsEditing(false);
			logger.info("Pricing settings updated", {
				updatedFields: Object.keys(data),
			});
		} catch (error) {
			errorHandlingService.handleError(error, {
				action: "update_pricing_settings",
				component: "PricingSettingsCard",
				data,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderField = (fieldName: keyof PricingFormData) => {
		const config = fieldConfig[fieldName];

		return (
			<FormField
				key={fieldName}
				control={form.control}
				name={fieldName}
				render={({ field }) => (
					<FormItem>
						<FormLabel className="flex items-center gap-2">
							{config.label}
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
									</TooltipTrigger>
									<TooltipContent className="max-w-xs">
										<p>{config.helpText}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</FormLabel>
						<FormControl>
							<div className="relative">
								{config.prefix && (
									<span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
										{config.prefix}
									</span>
								)}
								<Input
									{...field}
									placeholder={config.placeholder}
									className={
										config.prefix
											? "pl-8"
											: config.suffix
											? "pr-8"
											: ""
									}
								/>
								{config.suffix && (
									<span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
										{config.suffix}
									</span>
								)}
							</div>
						</FormControl>
						<FormDescription>{config.description}</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>
		);
	};

	if (!isEditing) {
		return (
			<Card className="transition-all duration-300 hover:shadow-lg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<DollarSign className="h-5 w-5" aria-hidden="true" />
						<span id="pricing-settings-heading">
							Pricing Configuration
						</span>
					</CardTitle>
					<CardDescription>
						Configure pricing for certificates, forensic work, and
						other billable services
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Display current values */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4">
							{Object.entries(fieldConfig).map(
								([fieldName, config]) => {
									const value =
										settings[
											fieldName as keyof SystemSettings
										];
									const displayValue =
										config.suffix === "%"
											? `${value}%`
											: `$${parseFloat(
													value as string
											  ).toFixed(
													fieldName ===
														"cost_per_kilometer_fuel"
														? 3
														: 2
											  )}`;

									return (
										<div
											key={fieldName}
											className="space-y-1 p-3 rounded-lg bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:scale-105 animate-in fade-in-50 slide-in-from-bottom-2"
										>
											<div className="flex items-center gap-2">
												<Label className="text-sm font-medium">
													{config.label}
												</Label>
												{/* <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help transition-colors hover:text-foreground" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs">
                                                        <p>{config.helpText}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider> */}
											</div>
											<div className="text-lg font-semibold text-primary transition-colors">
												{displayValue}
											</div>
											<p className="text-xs text-muted-foreground">
												{config.description}
											</p>
										</div>
									);
								}
							)}
						</div>

						<div className="pt-4 border-t">
							<Button
								onClick={handleEdit}
								className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
							>
								Edit Pricing Settings
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="transition-all duration-300 hover:shadow-lg">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<DollarSign className="h-5 w-5" aria-hidden="true" />
					<span id="pricing-settings-heading">
						Edit Pricing Configuration
					</span>
				</CardTitle>
				<CardDescription>
					Update pricing for certificates, forensic work, and other
					billable services
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-6"
					>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
							{Object.keys(fieldConfig).map((fieldName) =>
								renderField(fieldName as keyof PricingFormData)
							)}
						</div>

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
