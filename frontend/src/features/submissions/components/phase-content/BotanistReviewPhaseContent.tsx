import { observer } from "mobx-react-lite";
import { useState } from "react";
import { type Submission } from "@/shared/types/backend-api.types";
import {
	Microscope,
	Calendar,
	FileText,
	Package,
	Users,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import Calendar22 from "@/shared/components/ui/calendar-22";
import { Button } from "@/shared/components/ui/button";

interface BotanistReviewPhaseContentProps {
	submission: Submission;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
}

// Botanical determination choices (matches backend DeterminationChoices)
const DETERMINATION_CHOICES = [
	{ value: "pending", label: "Pending Assessment" },
	{ value: "cannabis_sativa", label: "Cannabis sativa" },
	{ value: "cannabis_indica", label: "Cannabis indica" },
	{ value: "cannabis_hybrid", label: "Cannabis (hybrid)" },
	{ value: "mixed", label: "Mixed" },
	{ value: "papaver_somniferum", label: "Papaver somniferum" },
	{ value: "degraded", label: "Degraded" },
	{ value: "not_cannabis", label: "Not Cannabis" },
	{ value: "unidentifiable", label: "Unidentifiable" },
	{ value: "inconclusive", label: "Inconclusive" },
];

/**
 * Botanist Review Phase Content Component
 *
 * Displays drug bags with assessment forms for botanical determinations.
 * - Read-only submission summary
 * - Editable assessment forms when current phase with edit permission
 * - Shows approval timestamp and approver when completed
 * - Validates all bags are assessed before allowing advancement
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export const BotanistReviewPhaseContent =
	observer<BotanistReviewPhaseContentProps>(
		({ submission, isCurrentPhase, canEdit }) => {
			// Local state for assessment data (in real implementation, this would be managed by a store or API)
			const [assessmentDate, setAssessmentDate] = useState<string>(
				submission.bags[0]?.assessment?.assessment_date?.split(
					"T"
				)[0] || new Date().toISOString().split("T")[0]
			);

			// Check if all bags have been assessed (determination is not "pending")
			const allBagsAssessed = submission.bags.every(
				(bag) =>
					bag.assessment?.determination &&
					bag.assessment.determination !== "pending"
			);

			// If current phase and can edit, show editable assessment forms
			if (isCurrentPhase && canEdit) {
				return (
					<div className="space-y-4">
						{/* Editing indicator */}
						<div className="p-4 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded">
							<div className="flex items-center gap-2">
								<Microscope className="h-5 w-5 text-green-600 dark:text-green-400" />
								<div>
									<p className="text-sm font-medium text-green-900 dark:text-green-100">
										Botanist Review Phase
									</p>
									<p className="text-xs text-green-700 dark:text-green-300">
										Review and assess each drug bag below.
										All bags must be assessed before
										advancing to the next phase.
									</p>
								</div>
							</div>
						</div>

						{/* Assessment validation warning */}
						{!allBagsAssessed && (
							<div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded">
								<div className="flex items-center gap-2">
									<AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
									<div>
										<p className="text-sm font-medium text-amber-900 dark:text-amber-100">
											Assessment Incomplete
										</p>
										<p className="text-xs text-amber-700 dark:text-amber-300">
											All drug bags must have a
											determination selected before you
											can advance to the Documents phase.
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Assessment Date */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Calendar className="h-5 w-5" />
									Assessment Date
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="max-w-md">
									<Label>Date of Assessment</Label>
									<Calendar22
										value={assessmentDate}
										onChange={(date) =>
											setAssessmentDate(date)
										}
										placeholder="Select assessment date"
										className="mt-2"
									/>
								</div>
							</CardContent>
						</Card>

						{/* Drug Bags Assessment Forms */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Package className="h-5 w-5" />
									Drug Bags Assessment (
									{submission.bags.length})
								</CardTitle>
							</CardHeader>
							<CardContent>
								{submission.bags.length > 0 ? (
									<div className="space-y-6">
										{submission.bags.map((bag, index) => {
											const determination =
												bag.assessment?.determination ||
												"pending";
											const botanistNotes =
												bag.assessment
													?.botanist_notes || "";

											return (
												<div
													key={bag.id}
													className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4"
												>
													{/* Bag Header */}
													<div className="flex items-start justify-between">
														<div>
															<p className="text-base font-semibold text-gray-900 dark:text-gray-100">
																Bag {index + 1}
															</p>
															<p className="text-sm text-gray-500 dark:text-gray-400">
																{
																	bag.content_type_display
																}
															</p>
														</div>
														<Badge variant="outline">
															{
																bag.seal_tag_numbers
															}
														</Badge>
													</div>

													{/* Bag Details */}
													<div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded">
														<div>
															<span className="text-gray-500 dark:text-gray-400">
																Original Tags:
															</span>
															<span className="ml-2 text-gray-900 dark:text-gray-100">
																{
																	bag.seal_tag_numbers
																}
															</span>
														</div>
														<div>
															<span className="text-gray-500 dark:text-gray-400">
																New Tags:
															</span>
															<span className="ml-2 text-gray-900 dark:text-gray-100">
																{bag.new_seal_tag_numbers ||
																	"N/A"}
															</span>
														</div>
														{bag.gross_weight && (
															<div>
																<span className="text-gray-500 dark:text-gray-400">
																	Gross
																	Weight:
																</span>
																<span className="ml-2 text-gray-900 dark:text-gray-100">
																	{
																		bag.gross_weight
																	}
																	g
																</span>
															</div>
														)}
														{bag.net_weight && (
															<div>
																<span className="text-gray-500 dark:text-gray-400">
																	Net Weight:
																</span>
																<span className="ml-2 text-gray-900 dark:text-gray-100">
																	{
																		bag.net_weight
																	}
																	g
																</span>
															</div>
														)}
													</div>

													{/* Determination Dropdown */}
													<div className="space-y-2">
														<Label
															htmlFor={`determination-${bag.id}`}
															className="required"
														>
															Botanical
															Determination
														</Label>
														<Select
															value={
																determination
															}
															onValueChange={(
																value
															) => {
																// TODO: Update assessment determination
																console.log(
																	`Update bag ${bag.id} determination to ${value}`
																);
															}}
														>
															<SelectTrigger
																id={`determination-${bag.id}`}
															>
																<SelectValue placeholder="Select determination" />
															</SelectTrigger>
															<SelectContent>
																{DETERMINATION_CHOICES.map(
																	(
																		choice
																	) => (
																		<SelectItem
																			key={
																				choice.value
																			}
																			value={
																				choice.value
																			}
																		>
																			{
																				choice.label
																			}
																		</SelectItem>
																	)
																)}
															</SelectContent>
														</Select>
													</div>

													{/* Botanist Notes */}
													<div className="space-y-2">
														<Label
															htmlFor={`notes-${bag.id}`}
														>
															Botanist Notes
															(Optional)
														</Label>
														<Textarea
															id={`notes-${bag.id}`}
															value={
																botanistNotes
															}
															onChange={(e) => {
																// TODO: Update assessment notes
																console.log(
																	`Update bag ${bag.id} notes to ${e.target.value}`
																);
															}}
															placeholder="Add any observations or notes about this bag..."
															rows={3}
															className="resize-none"
														/>
													</div>

													{/* Assessment Status Indicator */}
													{determination !==
														"pending" && (
														<div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
															<CheckCircle2 className="h-4 w-4" />
															<span>
																Assessment
																complete
															</span>
														</div>
													)}
												</div>
											);
										})}
									</div>
								) : (
									<p className="text-sm text-gray-500 dark:text-gray-400">
										No drug bags to assess
									</p>
								)}
							</CardContent>
						</Card>

						{/* Save Button (placeholder) */}
						<div className="flex justify-end">
							<Button
								onClick={() => {
									// TODO: Implement save logic
									console.log("Save assessments");
								}}
								disabled={!allBagsAssessed}
							>
								Save Assessments
							</Button>
						</div>
					</div>
				);
			}

			// Otherwise, show read-only summary
			return (
				<div className="space-y-6">
					{/* Historical data indicator */}
					{!isCurrentPhase && (
						<div className="p-4 bg-gray-50 border-l-4 border-gray-400 rounded">
							<div className="flex items-center gap-2">
								<Microscope className="h-5 w-5 text-gray-600" />
								<div>
									<p className="text-sm font-medium text-gray-900">
										Viewing Historical Data
									</p>
									<p className="text-xs text-gray-600">
										This is a read-only view of the botanist
										review phase. The submission has moved
										to {submission.phase_display}.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Approval Information */}
					{submission.botanist_approved_at && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CheckCircle2 className="h-5 w-5 text-green-600" />
									Botanist Approval
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
											Approved By
										</p>
										<p className="text-base text-gray-900 dark:text-gray-100">
											{submission
												.approved_botanist_details
												?.full_name || "Unknown"}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
											Approved At
										</p>
										<p className="text-base text-gray-900 dark:text-gray-100">
											{new Date(
												submission.botanist_approved_at
											).toLocaleString()}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

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

					{/* Drug Bags with Assessments */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Package className="h-5 w-5" />
								Drug Bags Assessment ({submission.bags.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{submission.bags.length > 0 ? (
								<div className="space-y-4">
									{submission.bags.map((bag, index) => (
										<div
											key={bag.id}
											className="p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 space-y-3"
										>
											{/* Bag Header */}
											<div className="flex items-start justify-between">
												<div>
													<p className="text-base font-semibold text-gray-900 dark:text-gray-100">
														Bag {index + 1}
													</p>
													<p className="text-sm text-gray-500 dark:text-gray-400">
														{
															bag.content_type_display
														}
													</p>
												</div>
												<Badge variant="outline">
													{bag.seal_tag_numbers}
												</Badge>
											</div>

											{/* Bag Details */}
											<div className="grid grid-cols-2 gap-2 text-sm">
												<div>
													<span className="text-gray-500 dark:text-gray-400">
														Original Tags:
													</span>
													<span className="ml-2 text-gray-900 dark:text-gray-100">
														{bag.seal_tag_numbers}
													</span>
												</div>
												<div>
													<span className="text-gray-500 dark:text-gray-400">
														New Tags:
													</span>
													<span className="ml-2 text-gray-900 dark:text-gray-100">
														{bag.new_seal_tag_numbers ||
															"N/A"}
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
												{bag.net_weight && (
													<div>
														<span className="text-gray-500 dark:text-gray-400">
															Net Weight:
														</span>
														<span className="ml-2 text-gray-900 dark:text-gray-100">
															{bag.net_weight}g
														</span>
													</div>
												)}
											</div>

											{/* Assessment Results */}
											{bag.assessment && (
												<div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
													<div>
														<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
															Determination
														</p>
														<div className="flex items-center gap-2 mt-1">
															<Badge
																variant={
																	bag
																		.assessment
																		.determination ===
																	"pending"
																		? "secondary"
																		: "default"
																}
															>
																{
																	bag
																		.assessment
																		.determination_display
																}
															</Badge>
															{bag.assessment
																.is_cannabis && (
																<Badge
																	variant="outline"
																	className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300"
																>
																	Cannabis
																</Badge>
															)}
														</div>
													</div>

													{bag.assessment
														.botanist_notes && (
														<div>
															<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
																Botanist Notes
															</p>
															<p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
																{
																	bag
																		.assessment
																		.botanist_notes
																}
															</p>
														</div>
													)}

													{bag.assessment
														.assessment_date && (
														<div>
															<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
																Assessment Date
															</p>
															<p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
																{new Date(
																	bag.assessment.assessment_date
																).toLocaleDateString()}
															</p>
														</div>
													)}
												</div>
											)}
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-gray-500 dark:text-gray-400">
									No drug bags to assess
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			);
		}
	);

BotanistReviewPhaseContent.displayName = "BotanistReviewPhaseContent";
