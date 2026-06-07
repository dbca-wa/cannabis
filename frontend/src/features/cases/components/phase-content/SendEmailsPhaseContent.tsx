import { observer } from "mobx-react-lite";
import { useState } from "react";
import { type Case } from "@/shared/types/backend-api.types";
import {
	Mail,
	FileText,
	Receipt,
	CheckCircle2,
	AlertCircle,
	Loader,
	Clock,
	Send,
	ArrowRight,
	User,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";

interface SendEmailsPhaseContentProps {
	caseObj: Case;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Case>) => Promise<void>;
}

/** Email document types that are sent during this phase */
const EMAIL_DOCUMENTS = [
	{
		id: "certificate",
		label: "Certificate PDF",
		description: "Botanical identification certificate",
		icon: FileText,
	},
	{
		id: "invoice",
		label: "Invoice PDF",
		description: "Invoice for services rendered",
		icon: Receipt,
	},
	{
		id: "notification",
		label: "Notification Email",
		description: "Completion notification to relevant parties",
		icon: Mail,
	},
] as const;

/**
 * Send Emails Phase Content
 *
 * Displays the email sending interface for the current phase,
 * or a read-only summary derived from phase history and the
 * emails_sent_at timestamp for completed phases.
 */
export const SendEmailsPhaseContent = observer<SendEmailsPhaseContentProps>(
	({ caseObj, isCurrentPhase, canEdit, onUpdate }) => {
		const [isSending, setIsSending] = useState(false);

		// Derive sent status from the case's emails_sent_at timestamp
		const emailsSent = !!caseObj.emails_sent_at;

		// Filter phase history entries relevant to the send_emails phase
		const sendEmailsHistory = (caseObj.phase_history ?? []).filter(
			(entry) =>
				entry.to_phase === "send_emails" || entry.from_phase === "send_emails"
		);

		// Handle sending all emails (triggers phase advance)
		const handleSendEmails = async () => {
			if (!onUpdate) return;
			setIsSending(true);

			try {
				await onUpdate({});
				toast.success("Emails sent successfully");
			} catch (error) {
				console.error("Failed to send emails:", error);
				toast.error("Failed to send emails. Please try again.");
			} finally {
				setIsSending(false);
			}
		};

		// Active phase with edit permission — show sending interface
		if (isCurrentPhase && canEdit) {
			return (
				<div className="space-y-4">
					{/* Phase indicator */}
					<div className="p-4 bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500 rounded">
						<div className="flex items-center gap-2">
							<Mail className="h-5 w-5 text-orange-600 dark:text-orange-400" />
							<div>
								<p className="text-sm font-medium text-orange-900 dark:text-orange-100">
									Send Emails Phase
								</p>
								<p className="text-xs text-orange-700 dark:text-orange-300">
									Send generated documents and notifications to relevant
									parties.
								</p>
							</div>
						</div>
					</div>

					{/* Email documents to be sent */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Mail className="h-5 w-5" />
								Documents to Send
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{EMAIL_DOCUMENTS.map((doc) => {
								const Icon = doc.icon;
								return (
									<div
										key={doc.id}
										className="flex items-center gap-3 p-3 border rounded-lg"
									>
										<Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												{doc.label}
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{doc.description}
											</p>
										</div>
										<Badge variant="secondary">
											<Clock className="mr-1 h-3 w-3" />
											Ready
										</Badge>
									</div>
								);
							})}
						</CardContent>
					</Card>

					{/* Email preview */}
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
											{caseObj.requesting_officer_details?.email ||
												caseObj.submitting_officer_details?.email ||
												"Requesting officer"}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-gray-500 dark:text-gray-400">
											Subject:
										</p>
										<p className="text-sm text-gray-900 dark:text-gray-100">
											Botanical Identification Complete - Case{" "}
											{caseObj.case_number}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-gray-500 dark:text-gray-400">
											Attachments:
										</p>
										<ul className="text-sm text-gray-700 dark:text-gray-300 mt-1 list-disc list-inside ml-2 space-y-1">
											<li>Certificate of Approved Botanist</li>
											<li>Invoice for Services</li>
										</ul>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Send action */}
					<div className="flex justify-end">
						<Button
							onClick={handleSendEmails}
							disabled={isSending}
							className="bg-orange-600 hover:bg-orange-700"
						>
							{isSending ? (
								<>
									<Loader className="mr-2 h-4 w-4 animate-spin" />
									Sending Emails...
								</>
							) : (
								<>
									<Send className="mr-2 h-4 w-4" />
									Send All Emails
								</>
							)}
						</Button>
					</div>
				</div>
			);
		}

		// Read-only summary — show delivery status from real data
		return (
			<div className="space-y-6">
				{/* Historical indicator for past phases */}
				{!isCurrentPhase && (
					<div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 rounded">
						<div className="flex items-center gap-2">
							<Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
							<div>
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Viewing Historical Data
								</p>
								<p className="text-xs text-gray-600 dark:text-gray-400">
									This is a read-only view. The case has moved to{" "}
									{caseObj.phase_display}.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Email delivery status */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Mail className="h-5 w-5" />
							Email Delivery Status
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{EMAIL_DOCUMENTS.map((doc) => {
							const Icon = doc.icon;
							return (
								<div
									key={doc.id}
									className="flex items-center justify-between p-3 border rounded-lg"
								>
									<div className="flex items-center gap-3">
										<Icon className="h-5 w-5 text-gray-500" />
										<div>
											<p className="text-sm font-medium">{doc.label}</p>
											{emailsSent && caseObj.emails_sent_at && (
												<p className="text-xs text-gray-500">
													Sent on{" "}
													{new Date(
														caseObj.emails_sent_at
													).toLocaleDateString()}
												</p>
											)}
										</div>
									</div>
									<div>
										{emailsSent ? (
											<Badge
												variant="default"
												className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
											>
												<CheckCircle2 className="mr-1 h-3 w-3" />
												Sent
											</Badge>
										) : (
											<Badge variant="secondary">
												<AlertCircle className="mr-1 h-3 w-3" />
												Not Sent
											</Badge>
										)}
									</div>
								</div>
							);
						})}

						{/* Emails sent timestamp */}
						{emailsSent && caseObj.emails_sent_at && (
							<div className="pt-3 border-t">
								<p className="text-sm text-gray-500">
									All emails sent on{" "}
									{new Date(caseObj.emails_sent_at).toLocaleString()}
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Phase history for send_emails phase */}
				{sendEmailsHistory.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="h-5 w-5" />
								Phase History
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{sendEmailsHistory
									.sort(
										(a, b) =>
											new Date(a.timestamp).getTime() -
											new Date(b.timestamp).getTime()
									)
									.map((entry) => (
										<div
											key={entry.id}
											className="flex items-start gap-3 p-3 border rounded-lg"
										>
											<div
												className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
													entry.action === "advance"
														? "bg-green-500"
														: "bg-amber-500"
												}`}
											>
												<ArrowRight
													className={`h-3.5 w-3.5 text-white ${
														entry.action === "send_back" ? "rotate-180" : ""
													}`}
												/>
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<Badge variant="outline" className="font-medium">
														{entry.to_phase_display}
													</Badge>
													{entry.action === "send_back" && (
														<Badge variant="destructive" className="text-xs">
															Sent Back
														</Badge>
													)}
												</div>
												<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
													{entry.action === "advance"
														? `Advanced from ${entry.from_phase_display}`
														: `Sent back from ${entry.from_phase_display}`}
												</p>
												{entry.reason && (
													<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
														Reason: {entry.reason}
													</p>
												)}
												<div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
													<User className="h-3 w-3" />
													<span>
														{entry.user_details?.full_name || "System"}
													</span>
													<span>•</span>
													<span>
														{new Date(entry.timestamp).toLocaleString()}
													</span>
												</div>
											</div>
										</div>
									))}
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		);
	}
);

SendEmailsPhaseContent.displayName = "SendEmailsPhaseContent";
