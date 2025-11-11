import { observer } from "mobx-react-lite";
import { useState } from "react";
import { type Submission } from "@/shared/types/backend-api.types";
import {
	DollarSign,
	FileText,
	Calendar,
	Package,
	Users,
	CheckCircle2,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { toast } from "sonner";
import { useSystemSettings } from "@/shared/hooks/data/useSystemSettings";
import { SubmissionFormLayout } from "../SubmissionFormLayout";
import { InvoicePDFPreview } from "../InvoicePDFPreview";

interface FinanceApprovalPhaseContentProps {
	submission: Submission;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
}

/**
 * Finance Approval Phase Content Component
 *
 * Displays submission summary with cost breakdown for finance review.
 * - Read-only submission summary
 * - Cost breakdown section with calculated costs
 * - Finance officer notes textarea (editable if permitted)
 * - Approval checkbox (editable if permitted)
 * - Shows approval timestamp and approver when completed
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export const FinanceApprovalPhaseContent =
	observer<FinanceApprovalPhaseContentProps>(
		({ submission, isCurrentPhase, canEdit, onUpdate }) => {
			// Local state for editable fields
			const [financeNotes, setFinanceNotes] = useState<string>("");
			const [isApproved, setIsApproved] = useState<boolean>(false);
			const [isSaving, setIsSaving] = useState<boolean>(false);
			const [forensicHours, setForensicHours] = useState<string>(
				submission.forensic_hours || ""
			);
			const [fuelDistanceKm, setFuelDistanceKm] = useState<string>(
				submission.fuel_distance_km || ""
			);

			// Fetch system settings for pricing
			const { data: systemSettings } =
				useSystemSettings();

			// Calculate costs based on submission data and system settings
			const calculateCosts = () => {
				if (!systemSettings) {
					// Return default values if settings not loaded
					return {
						bagProcessingFee: 0,
						bagCount: submission.bags.length,
						bagProcessingTotal: 0,
						certificateFee: 0,
						certificateCount: submission.certificates.length || 1,
						certificateTotal: 0,
						callOutFee: 0,
						callOutTotal: 0,
						forensicHourlyRate: 0,
						forensicHoursValue: 0,
						forensicTotal: 0,
						fuelCostPerKm: 0,
						fuelDistanceValue: 0,
						fuelTotal: 0,
						additionalFees: submission.additional_fees,
						additionalFeesTotal: 0,
						subtotal: 0,
						gst: 0,
						gstRate: 0,
						total: 0,
					};
				}

				// Parse settings from backend (they come as strings)
				const certificateFee = parseFloat(
					systemSettings.cost_per_certificate
				);
				const bagFee = parseFloat(systemSettings.cost_per_bag);
				const callOutFee = parseFloat(systemSettings.call_out_fee);
				const forensicHourlyRate = parseFloat(
					systemSettings.cost_per_forensic_hour
				);
				const fuelCostPerKm = parseFloat(
					systemSettings.cost_per_kilometer_fuel
				);
				const taxRate = parseFloat(systemSettings.tax_percentage) / 100;

				const bagCount = submission.bags.length;
				const certificateCount = submission.certificates.length || 1;

				// Calculate line items
				const certificateTotal = certificateCount * certificateFee;
				const bagProcessingTotal = bagCount * bagFee;

				// Call out fee (always included, fixed amount)
				const callOutTotal = callOutFee;

				// Forensic hours (if specified by finance officer)
				const forensicHoursValue = parseFloat(forensicHours) || 0;
				const forensicTotal = forensicHoursValue * forensicHourlyRate;

				// Fuel cost (if distance specified by finance officer)
				const fuelDistanceValue = parseFloat(fuelDistanceKm) || 0;
				const fuelTotal = fuelDistanceValue * fuelCostPerKm;

				// Additional fees from submission (exclude fuel, call_out, forensic as they're handled separately)
				const filteredAdditionalFees =
					submission.additional_fees.filter(
						(fee) =>
							!["fuel", "call_out", "forensic"].includes(
								fee.claim_kind
							)
					);
				const additionalFeesTotal = filteredAdditionalFees.reduce(
					(sum, fee) => sum + parseFloat(fee.calculated_cost || "0"),
					0
				);

				// Calculate subtotal
				const subtotal =
					certificateTotal +
					bagProcessingTotal +
					callOutTotal +
					forensicTotal +
					fuelTotal +
					additionalFeesTotal;

				// Calculate GST
				const gst = subtotal * taxRate;

				// Calculate total
				const total = subtotal + gst;

				return {
					bagProcessingFee: bagFee,
					bagCount,
					bagProcessingTotal,
					certificateFee,
					certificateCount,
					certificateTotal,
					callOutFee,
					callOutTotal,
					forensicHourlyRate,
					forensicHoursValue,
					forensicTotal,
					fuelCostPerKm,
					fuelDistanceValue,
					fuelTotal,
					additionalFees: submission.additional_fees,
					additionalFeesTotal,
					subtotal,
					gst,
					gstRate: parseFloat(systemSettings.tax_percentage),
					total,
				};
			};

			const costs = calculateCosts();

			// Handle save
			const handleSave = async () => {
				if (!onUpdate) return;

				setIsSaving(true);
				try {
					await onUpdate({
						forensic_hours: forensicHours || null,
						fuel_distance_km: fuelDistanceKm || null,
						// TODO: Add finance notes and approval fields to backend
						// finance_notes: financeNotes,
						// finance_approved: isApproved,
					});
					toast.success("Finance approval saved successfully");
				} catch (error) {
					toast.error("Failed to save finance approval");
					console.error("Error saving finance approval:", error);
				} finally {
					setIsSaving(false);
				}
			};

			// If current phase and can edit, show editable form with dual-pane layout
			if (isCurrentPhase && canEdit) {
				// Form content (left pane)
				const formContent = (
					<div className="space-y-4">
						{/* Editing indicator */}
						<div className="p-4 bg-cyan-50 dark:bg-cyan-950/20 border-l-4 border-cyan-500 rounded">
							<div className="flex items-center gap-2">
								<DollarSign className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
								<div>
									<p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
										Finance Approval Review
									</p>
									<p className="text-xs text-cyan-700 dark:text-cyan-300">
										Review the cost breakdown and invoice
										preview. Provide approval notes below.
									</p>
								</div>
							</div>
						</div>

						{/* Cost Breakdown Section */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<DollarSign className="h-5 w-5" />
									Cost Breakdown
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Line Items */}
								<div className="space-y-3">
									{/* Certificate Fee */}
									<div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
										<div>
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												Certificate Generation
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{costs.certificateCount}{" "}
												certificate(s) × A$
												{costs.certificateFee.toFixed(
													2
												)}
											</p>
										</div>
										<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
											A$
											{costs.certificateTotal.toFixed(2)}
										</p>
									</div>

									{/* Bag Processing */}
									<div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
										<div>
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												Bag Processing
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{costs.bagCount} bag(s) × A$
												{costs.bagProcessingFee.toFixed(
													2
												)}
											</p>
										</div>
										<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
											A$
											{costs.bagProcessingTotal.toFixed(
												2
											)}
										</p>
									</div>

									{/* Call Out Fee */}
									<div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
										<div>
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												Call Out Fee
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												Fixed fee
											</p>
										</div>
										<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
											A$
											{costs.callOutTotal.toFixed(2)}
										</p>
									</div>

									{/* Forensic Hours */}
									<div className="flex justify-between items-start pb-2 border-b border-gray-200 dark:border-gray-700">
										<div className="flex-1">
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
												Forensic Hours
											</p>
											<div className="flex items-center gap-2">
												<Input
													type="number"
													step="0.25"
													min="0"
													value={forensicHours}
													onChange={(e) =>
														setForensicHours(
															e.target.value
														)
													}
													placeholder="0.00"
													className="w-24"
												/>
												<span className="text-xs text-gray-500 dark:text-gray-400">
													hours × A$
													{costs.forensicHourlyRate.toFixed(
														2
													)}
													/hr
												</span>
											</div>
										</div>
										<p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
											A$
											{costs.forensicTotal.toFixed(2)}
										</p>
									</div>

									{/* Fuel Cost */}
									<div className="flex justify-between items-start pb-2 border-b border-gray-200 dark:border-gray-700">
										<div className="flex-1">
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
												Fuel Cost
											</p>
											<div className="flex items-center gap-2">
												<Input
													type="number"
													step="0.1"
													min="0"
													value={fuelDistanceKm}
													onChange={(e) =>
														setFuelDistanceKm(
															e.target.value
														)
													}
													placeholder="0.0"
													className="w-24"
												/>
												<span className="text-xs text-gray-500 dark:text-gray-400">
													km × A$
													{costs.fuelCostPerKm.toFixed(
														3
													)}
													/km
												</span>
											</div>
										</div>
										<p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
											A$
											{costs.fuelTotal.toFixed(2)}
										</p>
									</div>

									{/* Additional Fees */}
									{costs.additionalFees.length > 0 && (
										<>
											{costs.additionalFees.map((fee) => (
												<div
													key={fee.id}
													className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700"
												>
													<div>
														<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
															{
																fee.claim_kind_display
															}
														</p>
														<p className="text-xs text-gray-500 dark:text-gray-400">
															{fee.description ||
																`${fee.units} unit(s)`}
														</p>
													</div>
													<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
														A$
														{parseFloat(
															fee.calculated_cost
														).toFixed(2)}
													</p>
												</div>
											))}
										</>
									)}

									{/* Subtotal */}
									<div className="flex justify-between items-center pt-2">
										<p className="text-base font-medium text-gray-900 dark:text-gray-100">
											Subtotal
										</p>
										<p className="text-base font-semibold text-gray-900 dark:text-gray-100">
											A${costs.subtotal.toFixed(2)}
										</p>
									</div>

									{/* GST */}
									<div className="flex justify-between items-center">
										<p className="text-base font-medium text-gray-900 dark:text-gray-100">
											GST ({costs.gstRate}%)
										</p>
										<p className="text-base font-semibold text-gray-900 dark:text-gray-100">
											A${costs.gst.toFixed(2)}
										</p>
									</div>

									{/* Total */}
									<div className="flex justify-between items-center pt-3 border-t-2 border-gray-300 dark:border-gray-600">
										<p className="text-lg font-bold text-gray-900 dark:text-gray-100">
											Total Due
										</p>
										<p className="text-lg font-bold text-green-600 dark:text-green-400">
											A${costs.total.toFixed(2)}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Finance Officer Notes */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Finance Officer Notes
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Textarea
									value={financeNotes}
									onChange={(e) =>
										setFinanceNotes(e.target.value)
									}
									placeholder="Enter any notes regarding the financial approval..."
									className="min-h-[120px]"
								/>
							</CardContent>
						</Card>

						{/* Approval Checkbox */}
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="finance-approval"
										checked={isApproved}
										onCheckedChange={(checked) =>
											setIsApproved(checked as boolean)
										}
									/>
									<Label
										htmlFor="finance-approval"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										I approve the financial aspects of this
										submission
									</Label>
								</div>
							</CardContent>
						</Card>

						{/* Save Button */}
						<div className="flex justify-end">
							<Button
								onClick={handleSave}
								disabled={isSaving || !isApproved}
							>
								{isSaving ? "Saving..." : "Save Approval"}
							</Button>
						</div>
					</div>
				);

				// Preview content (right pane) - Invoice preview
				const previewContent = (
					<InvoicePDFPreview submission={submission} />
				);

				// Return dual-pane layout
				return (
					<SubmissionFormLayout
						formContent={formContent}
						previewContent={previewContent}
						showViewSwitcher={true}
					/>
				);
			}

			// Otherwise, show read-only summary
			return (
				<div className="space-y-6">
					{/* Historical data indicator */}
					{!isCurrentPhase && (
						<div className="p-4 bg-gray-50 border-l-4 border-gray-400 rounded">
							<div className="flex items-center gap-2">
								<DollarSign className="h-5 w-5 text-gray-600" />
								<div>
									<p className="text-sm font-medium text-gray-900">
										Viewing Historical Data
									</p>
									<p className="text-xs text-gray-600">
										This is a read-only view of the finance
										approval phase. The submission has moved
										to {submission.phase_display}.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Approval Status */}
					{submission.finance_approved_at && (
						<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
							<CardContent className="pt-6">
								<div className="flex items-start gap-3">
									<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
									<div className="flex-1">
										<p className="text-sm font-medium text-green-900 dark:text-green-100">
											Finance Approved
										</p>
										<p className="text-xs text-green-700 dark:text-green-300 mt-1">
											Approved by{" "}
											{submission.finance_officer_details
												?.full_name || "Unknown"}{" "}
											on{" "}
											{new Date(
												submission.finance_approved_at
											).toLocaleString()}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Cost Breakdown Section (Read-only) */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<DollarSign className="h-5 w-5" />
								Cost Breakdown
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Line Items */}
							<div className="space-y-3">
								{/* Base Examination Fee */}
								<div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
											Base Examination Fee
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Botanical examination service
										</p>
									</div>
									<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
										A$
										{(costs.certificateFee || 0).toFixed(2)}
									</p>
								</div>

								{/* Bag Processing */}
								<div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
											Bag Processing
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											{costs.bagCount} bag(s) × A$
											{costs.bagProcessingFee.toFixed(2)}
										</p>
									</div>
									<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
										A${costs.bagProcessingTotal.toFixed(2)}
									</p>
								</div>

								{/* Certificate Fee */}
								<div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
											Certificate Generation
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											{costs.certificateCount}{" "}
											certificate(s) × A$
											{costs.certificateFee.toFixed(2)}
										</p>
									</div>
									<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
										A${costs.certificateTotal.toFixed(2)}
									</p>
								</div>

								{/* Additional Fees */}
								{costs.additionalFees.length > 0 && (
									<>
										{costs.additionalFees.map((fee) => (
											<div
												key={fee.id}
												className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700"
											>
												<div>
													<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
														{fee.claim_kind_display}
													</p>
													<p className="text-xs text-gray-500 dark:text-gray-400">
														{fee.description ||
															`${fee.units} unit(s)`}
													</p>
												</div>
												<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
													A$
													{parseFloat(
														fee.calculated_cost
													).toFixed(2)}
												</p>
											</div>
										))}
									</>
								)}

								{/* Subtotal */}
								<div className="flex justify-between items-center pt-2">
									<p className="text-base font-medium text-gray-900 dark:text-gray-100">
										Subtotal
									</p>
									<p className="text-base font-semibold text-gray-900 dark:text-gray-100">
										A${costs.subtotal.toFixed(2)}
									</p>
								</div>

								{/* GST */}
								<div className="flex justify-between items-center">
									<p className="text-base font-medium text-gray-900 dark:text-gray-100">
										GST ({costs.gstRate}%)
									</p>
									<p className="text-base font-semibold text-gray-900 dark:text-gray-100">
										A${costs.gst.toFixed(2)}
									</p>
								</div>

								{/* Total */}
								<div className="flex justify-between items-center pt-3 border-t-2 border-gray-300 dark:border-gray-600">
									<p className="text-lg font-bold text-gray-900 dark:text-gray-100">
										Total Due
									</p>
									<p className="text-lg font-bold text-green-600 dark:text-green-400">
										A${costs.total.toFixed(2)}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Submission Summary */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Submission Summary
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
										Police Reference No.
									</p>
									<p className="text-base text-gray-900 dark:text-gray-100">
										{submission.case_number}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
										Received Date
									</p>
									<p className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
										<Calendar className="h-4 w-4" />
										{new Date(
											submission.received
										).toLocaleDateString()}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
										Requesting Officer
									</p>
									<p className="text-base text-gray-900 dark:text-gray-100">
										{submission.requesting_officer_details
											?.full_name || "Not assigned"}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
										Police Station
									</p>
									<p className="text-base text-gray-900 dark:text-gray-100">
										{submission.station_details?.name ||
											"Not assigned"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Drug Bags Summary */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Package className="h-5 w-5" />
								Drug Bags ({submission.bags.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{submission.bags.length > 0 ? (
								<div className="space-y-3">
									{submission.bags.map((bag, index) => (
										<div
											key={bag.id}
											className="p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
										>
											<div className="flex items-start justify-between mb-2">
												<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
													Bag {index + 1}
												</p>
												<Badge variant="outline">
													{bag.content_type_display}
												</Badge>
											</div>
											<div className="grid grid-cols-2 gap-2 text-sm">
												<div>
													<span className="text-gray-500 dark:text-gray-400">
														Original Tags:
													</span>
													<span className="ml-2 text-gray-900 dark:text-gray-100">
														{bag.seal_tag_numbers}
													</span>
												</div>
												{bag.gross_weight && (
													<div>
														<span className="text-gray-500 dark:text-gray-400">
															Gross Weight:
														</span>
														<span className="ml-2 text-gray-900 dark:text-gray-100">
															{bag.gross_weight}g
														</span>
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-gray-500 dark:text-gray-400">
									No drug bags recorded
								</p>
							)}
						</CardContent>
					</Card>

					{/* Defendants Summary */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Defendants (
								{submission.defendants_details.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{submission.defendants_details.length > 0 ? (
								<div className="space-y-2">
									{submission.defendants_details.map(
										(defendant) => (
											<div
												key={defendant.id}
												className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
											>
												<p className="text-base text-gray-900 dark:text-gray-100">
													{defendant.full_name}
												</p>
											</div>
										)
									)}
								</div>
							) : (
								<p className="text-sm text-gray-500 dark:text-gray-400">
									No defendants assigned
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			);
		}
	);

FinanceApprovalPhaseContent.displayName = "FinanceApprovalPhaseContent";
