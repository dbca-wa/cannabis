import { Receipt, Loader2 } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "../SectionCard";

interface InvoicingStepProps {
	/** Case data from TanStack Query — contains invoice_number if generated */
	caseData: Record<string, unknown> | null;
	/** Callback to trigger workflow actions (e.g. "generate_invoice") */
	onAction: (action: string) => void;
}

/**
 * Invoicing step — triggers invoice PDF generation based on case details
 * and fee configuration. Displays invoice number once complete.
 */
export const InvoicingStep = ({ caseData, onAction }: InvoicingStepProps) => {
	const invoiceNumber =
		typeof caseData?.invoice_number === "string"
			? caseData.invoice_number
			: null;

	const hasInvoice = !!invoiceNumber;
	const isGenerating = caseData?.is_generating_invoice === true;

	return (
		<div className="space-y-6">
			<SectionCard
				title="Invoice Generation"
				isComplete={hasInvoice}
				isInvalid={false}
			>
				{hasInvoice ? (
					<div className="flex items-center gap-3">
						<Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
						<span className="text-sm font-medium">Invoice generated ✓</span>
						<Badge variant="secondary">{invoiceNumber}</Badge>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
						<Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="mb-4 text-sm text-muted-foreground">
							Generate the invoice PDF based on the case details and configured
							fee rates. The invoice will be attached to the outgoing email.
						</p>
						<Button
							type="button"
							onClick={() => onAction("generate_invoice")}
							disabled={isGenerating}
						>
							{isGenerating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Generating…
								</>
							) : (
								<>
									<Receipt className="mr-2 h-4 w-4" />
									Generate Invoice
								</>
							)}
						</Button>
					</div>
				)}
			</SectionCard>
		</div>
	);
};
