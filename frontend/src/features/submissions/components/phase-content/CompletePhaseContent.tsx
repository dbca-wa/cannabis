import { observer } from "mobx-react-lite";
import { type Submission } from "@/shared/types/backend-api.types";
import {
	CheckCircle2,
	FileText,
	Receipt,
	Mail,
	Download,
	Clock,
	User,
	ArrowRight,
	Calendar,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

interface CompletePhaseContentProps {
	submission: Submission;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
}

/**
 * Complete Phase Content Component
 *
 * Displays completion summary for finished submissions.
 * - Success message with checkmark icon
 * - Completion summary (ID, date, processing time)
 * - Download links for all generated documents
 * - Email delivery status
 * - Phase transition timeline showing who performed each action and when
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 *
 * NOTE: This phase is read-only only - no editable mode
 */
export const CompletePhaseContent = observer<CompletePhaseContentProps>(
	({ submission }) => {
		// Calculate processing time
		const calculateProcessingTime = (): string => {
			if (!submission.completed_at) return "Unknown";

			const startDate = new Date(submission.created_at);
			const endDate = new Date(submission.completed_at);
			const diffMs = endDate.getTime() - startDate.getTime();

			const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			const hours = Math.floor(
				(diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
			);
			const minutes = Math.floor(
				(diffMs % (1000 * 60 * 60)) / (1000 * 60)
			);

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""}, ${hours} hour${
					hours !== 1 ? "s" : ""
				}`;
			} else if (hours > 0) {
				return `${hours} hour${
					hours !== 1 ? "s" : ""
				}, ${minutes} minute${minutes !== 1 ? "s" : ""}`;
			} else {
				return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
			}
		};

		// Calculate phase duration
		const calculatePhaseDuration = (
			fromTimestamp: string,
			toTimestamp: string
		): string => {
			const from = new Date(fromTimestamp);
			const to = new Date(toTimestamp);
			const diffMs = to.getTime() - from.getTime();

			const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			const hours = Math.floor(
				(diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
			);
			const minutes = Math.floor(
				(diffMs % (1000 * 60 * 60)) / (1000 * 60)
			);

			if (days > 0) {
				return `${days}d ${hours}h`;
			} else if (hours > 0) {
				return `${hours}h ${minutes}m`;
			} else {
				return `${minutes}m`;
			}
		};

		// Handle document download
		const handleDownload = (url: string, filename: string) => {
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		};

		// Get phase color for timeline
		const getPhaseColor = (phase: string): string => {
			const colorMap: Record<string, string> = {
				data_entry: "bg-gray-500",
				finance_approval: "bg-cyan-500",
				botanist_review: "bg-green-500",
				documents: "bg-purple-500",
				send_emails: "bg-orange-500",
				complete: "bg-emerald-500",
			};
			return colorMap[phase] || "bg-gray-500";
		};

		// Check if documents and emails are available
		const hasCertificate = !!submission.certificates?.length;
		const hasInvoice = !!submission.invoices?.length;
		const certificate = submission.certificates?.[0];
		const invoice = submission.invoices?.[0];

		return (
			<div className="space-y-6">
				{/* Success Message */}
				<div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 rounded-lg">
					<div className="flex items-start gap-4">
						<div className="flex-shrink-0">
							<div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
								<CheckCircle2 className="h-7 w-7 text-white" />
							</div>
						</div>
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
								Submission Complete
							</h3>
							<p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
								This submission has been successfully processed
								and all required documents have been generated
								and sent.
							</p>
						</div>
					</div>
				</div>

				{/* Completion Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-emerald-600" />
							Completion Summary
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Application ID
								</p>
								<p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
									{submission.case_number}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Completion Date
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									{submission.completed_at
										? new Date(
												submission.completed_at
										  ).toLocaleString()
										: "Unknown"}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Processing Time
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
									<Clock className="h-4 w-4" />
									{calculateProcessingTime()}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Generated Documents */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Generated Documents
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{/* Certificate */}
						<div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
							<div className="flex items-center gap-3">
								<FileText className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										Certificate of Approved Botanist
									</p>
									{certificate?.created_at && (
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Generated on{" "}
											{new Date(
												certificate.created_at
											).toLocaleDateString()}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{hasCertificate ? (
									<>
										<Badge
											variant="default"
											className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Available
										</Badge>
										{certificate?.pdf_url && (
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleDownload(
														certificate.pdf_url!,
														`certificate_${submission.case_number}.pdf`
													)
												}
											>
												<Download className="mr-2 h-3 w-3" />
												Download
											</Button>
										)}
									</>
								) : (
									<Badge variant="secondary">
										Not Available
									</Badge>
								)}
							</div>
						</div>

						{/* Invoice */}
						<div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
							<div className="flex items-center gap-3">
								<Receipt className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										Invoice for Services
									</p>
									{invoice?.created_at && (
										<p className="text-xs text-gray-500 dark:text-gray-400">
											Generated on{" "}
											{new Date(
												invoice.created_at
											).toLocaleDateString()}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{hasInvoice ? (
									<>
										<Badge
											variant="default"
											className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Available
										</Badge>
										{invoice?.pdf_url && (
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleDownload(
														invoice.pdf_url!,
														`invoice_${submission.case_number}.pdf`
													)
												}
											>
												<Download className="mr-2 h-3 w-3" />
												Download
											</Button>
										)}
									</>
								) : (
									<Badge variant="secondary">
										Not Available
									</Badge>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Email Delivery Status */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Mail className="h-5 w-5" />
							Email Delivery Status
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{/* Email items - using mock data for now */}
							{[
								{
									label: "Certificate PDF",
									icon: FileText,
									sent: true,
								},
								{
									label: "Invoice PDF",
									icon: Receipt,
									sent: true,
								},
								{
									label: "Notification Email",
									icon: Mail,
									sent: true,
								},
							].map((email) => {
								const Icon = email.icon;
								return (
									<div
										key={email.label}
										className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
									>
										<div className="flex items-center gap-3">
											<Icon className="h-5 w-5 text-gray-500" />
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												{email.label}
											</p>
										</div>
										<Badge
											variant="default"
											className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Sent
										</Badge>
									</div>
								);
							})}

							{/* Emails Sent Timestamp */}
							{submission.emails_sent_at && (
								<div className="pt-3 border-t border-gray-200 dark:border-gray-700">
									<p className="text-sm text-gray-500 dark:text-gray-400">
										All emails sent on{" "}
										{new Date(
											submission.emails_sent_at
										).toLocaleString()}
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Phase Transition Timeline */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Phase Transition Timeline
						</CardTitle>
					</CardHeader>
					<CardContent>
						{submission.phase_history &&
						submission.phase_history.length > 0 ? (
							<div className="space-y-4">
								{/* Sort phase history by timestamp (oldest first for timeline) */}
								{[...submission.phase_history]
									.sort(
										(a, b) =>
											new Date(a.timestamp).getTime() -
											new Date(b.timestamp).getTime()
									)
									.map((entry, index, array) => {
										const isLast =
											index === array.length - 1;
										const nextEntry = !isLast
											? array[index + 1]
											: null;
										const duration =
											nextEntry &&
											calculatePhaseDuration(
												entry.timestamp,
												nextEntry.timestamp
											);

										return (
											<div
												key={entry.id}
												className="relative"
											>
												{/* Timeline connector line */}
												{!isLast && (
													<div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
												)}

												{/* Timeline entry */}
												<div className="flex items-start gap-4">
													{/* Phase indicator dot */}
													<div
														className={`flex-shrink-0 w-8 h-8 rounded-full ${getPhaseColor(
															entry.to_phase
														)} flex items-center justify-center relative z-10`}
													>
														{entry.action ===
														"advance" ? (
															<ArrowRight className="h-4 w-4 text-white" />
														) : (
															<ArrowRight className="h-4 w-4 text-white transform rotate-180" />
														)}
													</div>

													{/* Entry content */}
													<div className="flex-1 pb-6">
														<div className="flex items-start justify-between gap-4">
															<div className="flex-1">
																<div className="flex items-center gap-2 flex-wrap">
																	<Badge
																		variant="outline"
																		className="font-medium"
																	>
																		{
																			entry.to_phase_display
																		}
																	</Badge>
																	{entry.action ===
																		"send_back" && (
																		<Badge
																			variant="destructive"
																			className="text-xs"
																		>
																			Sent
																			Back
																		</Badge>
																	)}
																</div>

																<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
																	{entry.action ===
																	"advance"
																		? `Advanced from ${entry.from_phase_display}`
																		: `Sent back from ${entry.from_phase_display}`}
																</p>

																{/* User who performed action */}
																<div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
																	<User className="h-3 w-3" />
																	<span>
																		{entry
																			.user_details
																			?.full_name ||
																			"System"}
																	</span>
																	<span>
																		•
																	</span>
																	<span>
																		{new Date(
																			entry.timestamp
																		).toLocaleString()}
																	</span>
																	{duration && (
																		<>
																			<span>
																				•
																			</span>
																			<span className="text-gray-400">
																				Duration:{" "}
																				{
																					duration
																				}
																			</span>
																		</>
																	)}
																</div>

																{/* Send-back reason */}
																{entry.reason && (
																	<div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 border-l-2 border-amber-500 rounded text-xs">
																		<p className="font-medium text-amber-900 dark:text-amber-100">
																			Reason:
																		</p>
																		<p className="text-amber-700 dark:text-amber-300 mt-0.5">
																			{
																				entry.reason
																			}
																		</p>
																	</div>
																)}
															</div>
														</div>
													</div>
												</div>
											</div>
										);
									})}
							</div>
						) : (
							<p className="text-sm text-gray-500 dark:text-gray-400">
								No phase history available
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}
);

CompletePhaseContent.displayName = "CompletePhaseContent";
