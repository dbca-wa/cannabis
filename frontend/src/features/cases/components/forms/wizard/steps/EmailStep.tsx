import { Mail, FileText, Loader2 } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "../SectionCard";

interface EmailStepProps {
	/** Case data from TanStack Query — contains configured email and document info */
	caseData: Record<string, unknown> | null;
	/** Callback to trigger workflow actions (e.g. "send_documents") */
	onAction: (action: string) => void;
}

/**
 * Email step — displays the configured recipient email address and the
 * document attachments (certificate + invoice) to be sent. Triggers the
 * send-documents endpoint on action, completing the case lifecycle.
 */
export const EmailStep = ({ caseData, onAction }: EmailStepProps) => {
	const configuredEmail =
		typeof caseData?.configured_email === "string"
			? caseData.configured_email
			: null;

	const certificateNumber =
		typeof caseData?.certificate_number === "string"
			? caseData.certificate_number
			: null;

	const invoiceNumber =
		typeof caseData?.invoice_number === "string"
			? caseData.invoice_number
			: null;

	const phase = typeof caseData?.phase === "string" ? caseData.phase : null;

	const isSent = phase === "complete";
	const isSending = caseData?.is_sending_documents === true;

	return (
		<div className="space-y-6">
			{/* Recipient */}
			<SectionCard
				title="Email Recipient"
				isComplete={isSent}
				isInvalid={false}
			>
				{configuredEmail ? (
					<div className="flex items-center gap-2">
						<Mail className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm">Send to:</span>
						<Badge variant="outline">{configuredEmail}</Badge>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">
						No email address configured. Set the document email address in
						System Settings.
					</p>
				)}
			</SectionCard>

			{/* Attachments */}
			<SectionCard
				title="Document Attachments"
				isComplete={isSent}
				isInvalid={false}
			>
				<div className="space-y-2">
					{certificateNumber && (
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm">Certificate</span>
							<Badge variant="secondary">{certificateNumber}</Badge>
						</div>
					)}
					{invoiceNumber && (
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm">Invoice</span>
							<Badge variant="secondary">{invoiceNumber}</Badge>
						</div>
					)}
					{!certificateNumber && !invoiceNumber && (
						<p className="text-sm text-muted-foreground">
							No documents available. Generate the certificate and invoice in
							the previous steps.
						</p>
					)}
				</div>
			</SectionCard>

			{/* Send action */}
			<SectionCard title="Send Documents" isComplete={isSent} isInvalid={false}>
				{isSent ? (
					<div className="flex items-center gap-3">
						<Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
						<span className="text-sm font-medium">Documents sent ✓</span>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
						<Mail className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="mb-4 text-sm text-muted-foreground">
							Send the certificate and invoice to the configured email address.
							This will complete the case.
						</p>
						<Button
							type="button"
							onClick={() => onAction("send_documents")}
							disabled={isSending || !configuredEmail || !certificateNumber}
						>
							{isSending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Sending…
								</>
							) : (
								<>
									<Mail className="mr-2 h-4 w-4" />
									Send Documents
								</>
							)}
						</Button>
					</div>
				)}
			</SectionCard>
		</div>
	);
};
