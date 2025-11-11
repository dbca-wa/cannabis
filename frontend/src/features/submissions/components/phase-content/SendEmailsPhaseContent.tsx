import { observer } from "mobx-react-lite";
import { useState } from "react";
import { type Submission } from "@/shared/types/backend-api.types";
import {
	Mail,
	FileText,
	Receipt,
	CheckCircle2,
	AlertCircle,
	Loader,
	Clock,
	Send,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { toast } from "sonner";

interface SendEmailsPhaseContentProps {
	submission: Submission;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
}

// Email types that can be sent
interface EmailItem {
	id: string;
	label: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
	sent: boolean;
	sentAt?: string;
	error?: string;
}

/**
 * Send Emails Phase Content Component
 *
 * Displays email checklist and sending interface for submission documents.
 * - Email checklist with checkboxes (Certificate PDF, Invoice PDF, Notification)
 * - Email preview section
 * - "Send All Emails" button
 * - Sending status indicators
 * - Sent timestamps
 * - Error handling with retry
 * - Auto-advance to Complete when all emails sent successfully
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export const SendEmailsPhaseContent = observer<SendEmailsPhaseContentProps>(
	({ submission, isCurrentPhase, canEdit }) => {
		// Local state for email sending
		const [isSendingAll, setIsSendingAll] = useState(false);
		const [sendingStatus, setSendingStatus] = useState<
			Record<string, boolean>
		>({});

		// Email items configuration
		// TODO: Replace with actual email status from backend
		const [emailItems, setEmailItems] = useState<EmailItem[]>([
			{
				id: "certificate",
				label: "Certificate PDF",
				description: "Send botanical identification certificate",
				icon: FileText,
				sent: false,
			},
			{
				id: "invoice",
				label: "Invoice PDF",
				description: "Send invoice for services rendered",
				icon: Receipt,
				sent: false,
			},
			{
				id: "notification",
				label: "Notification Email",
				description: "Send completion notification to relevant parties",
				icon: Mail,
				sent: false,
			},
		]);

		// Check if all emails have been sent
		const allEmailsSent = emailItems.every((item) => item.sent);

		// Handle sending individual email
		const handleSendEmail = async (emailId: string) => {
			setSendingStatus((prev) => ({ ...prev, [emailId]: true }));

			try {
				// TODO: Call API to send specific email
				// await submissionsService.sendEmail(submission.id, emailId);

				// Simulate API call
				await new Promise((resolve) => setTimeout(resolve, 1500));

				// Update email item status
				setEmailItems((prev) =>
					prev.map((item) =>
						item.id === emailId
							? {
									...item,
									sent: true,
									sentAt: new Date().toISOString(),
									error: undefined,
							  }
							: item
					)
				);

				toast.success(`${emailId} email sent successfully`);

				// Check if all emails are now sent
				const updatedItems = emailItems.map((item) =>
					item.id === emailId ? { ...item, sent: true } : item
				);
				if (updatedItems.every((item) => item.sent)) {
					// Auto-advance to Complete phase
					toast.success(
						"All emails sent! Advancing to Complete phase..."
					);
					// TODO: Call onUpdate to advance phase
					// await onUpdate?.({ phase: "complete" });
				}
			} catch (error) {
				console.error(`Failed to send ${emailId} email:`, error);

				// Update email item with error
				setEmailItems((prev) =>
					prev.map((item) =>
						item.id === emailId
							? {
									...item,
									error: "Failed to send email. Please try again.",
							  }
							: item
					)
				);

				toast.error(
					`Failed to send ${emailId} email. Please try again.`
				);
			} finally {
				setSendingStatus((prev) => ({ ...prev, [emailId]: false }));
			}
		};

		// Handle sending all emails
		const handleSendAllEmails = async () => {
			setIsSendingAll(true);

			try {
				// Send all unsent emails
				const unsentEmails = emailItems.filter((item) => !item.sent);

				for (const email of unsentEmails) {
					await handleSendEmail(email.id);
				}

				toast.success("All emails sent successfully!");
			} catch (error) {
				console.error("Failed to send all emails:", error);
				toast.error("Some emails failed to send. Please retry.");
			} finally {
				setIsSendingAll(false);
			}
		};

		// If current phase and can edit, show email sending interface
		if (isCurrentPhase && canEdit) {
			return (
				<div className="space-y-4">
					{/* Editing indicator */}
					<div className="p-4 bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500 rounded">
						<div className="flex items-center gap-2">
							<Mail className="h-5 w-5 text-orange-600 dark:text-orange-400" />
							<div>
								<p className="text-sm font-medium text-orange-900 dark:text-orange-100">
									Send Emails Phase
								</p>
								<p className="text-xs text-orange-700 dark:text-orange-300">
									Send generated documents and notifications
									to relevant parties.
								</p>
							</div>
						</div>
					</div>

					{/* Send All Emails Button */}
					{!allEmailsSent && (
						<div className="flex justify-end">
							<Button
								onClick={handleSendAllEmails}
								disabled={isSendingAll}
								className="bg-orange-600 hover:bg-orange-700"
							>
								{isSendingAll ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										Sending All Emails...
									</>
								) : (
									<>
										<Send className="mr-2 h-4 w-4" />
										Send All Emails
									</>
								)}
							</Button>
						</div>
					)}

					{/* Email Checklist */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Mail className="h-5 w-5" />
								Email Checklist
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{emailItems.map((email) => {
								const Icon = email.icon;
								const isSending = sendingStatus[email.id];

								return (
									<div
										key={email.id}
										className="flex items-start gap-4 p-4 border rounded-lg"
									>
										{/* Checkbox */}
										<div className="pt-1">
											<Checkbox
												checked={email.sent}
												disabled
												className="h-5 w-5"
											/>
										</div>

										{/* Email Icon */}
										<div className="flex-shrink-0 pt-0.5">
											<Icon className="h-5 w-5 text-gray-500" />
										</div>

										{/* Email Details */}
										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between gap-2">
												<div>
													<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
														{email.label}
													</p>
													<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
														{email.description}
													</p>
												</div>

												{/* Status Badge */}
												<div className="flex-shrink-0">
													{email.sent ? (
														<Badge
															variant="default"
															className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
														>
															<CheckCircle2 className="mr-1 h-3 w-3" />
															Sent
														</Badge>
													) : email.error ? (
														<Badge
															variant="destructive"
															className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
														>
															<AlertCircle className="mr-1 h-3 w-3" />
															Failed
														</Badge>
													) : (
														<Badge variant="secondary">
															<Clock className="mr-1 h-3 w-3" />
															Pending
														</Badge>
													)}
												</div>
											</div>

											{/* Sent Timestamp */}
											{email.sent && email.sentAt && (
												<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
													Sent on{" "}
													{new Date(
														email.sentAt
													).toLocaleString()}
												</p>
											)}

											{/* Error Message */}
											{email.error && (
												<p className="text-xs text-red-600 dark:text-red-400 mt-2">
													{email.error}
												</p>
											)}

											{/* Send/Retry Button */}
											{!email.sent && (
												<div className="mt-3">
													<Button
														size="sm"
														variant={
															email.error
																? "destructive"
																: "outline"
														}
														onClick={() =>
															handleSendEmail(
																email.id
															)
														}
														disabled={isSending}
													>
														{isSending ? (
															<>
																<Loader className="mr-2 h-3 w-3 animate-spin" />
																Sending...
															</>
														) : email.error ? (
															<>
																<Send className="mr-2 h-3 w-3" />
																Retry
															</>
														) : (
															<>
																<Send className="mr-2 h-3 w-3" />
																Send Now
															</>
														)}
													</Button>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</CardContent>
					</Card>

					{/* Email Preview Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Mail className="h-5 w-5" />
								Email Preview
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
								<div className="space-y-3">
									<div>
										<p className="text-xs font-medium text-gray-500 dark:text-gray-400">
											To:
										</p>
										<p className="text-sm text-gray-900 dark:text-gray-100">
											{submission
												.requesting_officer_details
												?.email ||
												submission
													.submitting_officer_details
													?.email ||
												"officer@example.com"}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-gray-500 dark:text-gray-400">
											Subject:
										</p>
										<p className="text-sm text-gray-900 dark:text-gray-100">
											Botanical Identification Complete -
											Case {submission.case_number}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-gray-500 dark:text-gray-400">
											Message:
										</p>
										<div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
											<p>Dear Officer,</p>
											<p>
												The botanical identification for
												case {submission.case_number}{" "}
												has been completed. Please find
												the attached certificate and
												invoice.
											</p>
											<p>
												<strong>Attachments:</strong>
											</p>
											<ul className="list-disc list-inside ml-4 space-y-1">
												<li>
													Certificate of Approved
													Botanist
												</li>
												<li>Invoice for Services</li>
											</ul>
											<p className="mt-4">
												Best regards,
												<br />
												WA Herbarium
											</p>
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Validation Warning */}
					{!allEmailsSent && (
						<div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-sm font-medium text-amber-900 dark:text-amber-100">
										Emails Pending
									</p>
									<p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
										All emails must be sent successfully
										before the submission can advance to
										Complete phase.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Success Message */}
					{allEmailsSent && (
						<div className="p-4 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-sm font-medium text-green-900 dark:text-green-100">
										All Emails Sent Successfully
									</p>
									<p className="text-xs text-green-700 dark:text-green-300 mt-1">
										The submission is ready to advance to
										Complete phase.
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			);
		}

		// Otherwise, show read-only summary
		return (
			<div className="space-y-6">
				{/* Historical data indicator (only if not current phase) */}
				{!isCurrentPhase && (
					<div className="p-4 bg-gray-50 border-l-4 border-gray-400 rounded">
						<div className="flex items-center gap-2">
							<Mail className="h-5 w-5 text-gray-600" />
							<div>
								<p className="text-sm font-medium text-gray-900">
									Viewing Historical Data
								</p>
								<p className="text-xs text-gray-600">
									This is a read-only view. The submission has
									moved to {submission.phase_display}.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Email Delivery Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Mail className="h-5 w-5" />
							Email Delivery Status
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{emailItems.map((email) => {
							const Icon = email.icon;

							return (
								<div
									key={email.id}
									className="flex items-center justify-between p-3 border rounded-lg"
								>
									<div className="flex items-center gap-3">
										<Icon className="h-5 w-5 text-gray-500" />
										<div>
											<p className="text-sm font-medium">
												{email.label}
											</p>
											{email.sent && email.sentAt && (
												<p className="text-xs text-gray-500">
													Sent on{" "}
													{new Date(
														email.sentAt
													).toLocaleDateString()}
												</p>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2">
										{email.sent ? (
											<Badge
												variant="default"
												className="bg-green-100 text-green-800"
											>
												<CheckCircle2 className="mr-1 h-3 w-3" />
												Sent
											</Badge>
										) : (
											<Badge variant="secondary">
												Not Sent
											</Badge>
										)}
									</div>
								</div>
							);
						})}

						{/* Emails Sent Timestamp */}
						{submission.emails_sent_at && (
							<div className="pt-3 border-t">
								<p className="text-sm text-gray-500">
									All emails sent on{" "}
									{new Date(
										submission.emails_sent_at
									).toLocaleString()}
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}
);

SendEmailsPhaseContent.displayName = "SendEmailsPhaseContent";
