import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { WizardPreviewPanel } from "../WizardPreviewPanel";
import { GeneratedCertificatesViewer } from "../GeneratedCertificatesViewer";
import type { Certificate } from "@/features/certificates/types/certificates.types";

interface UnsignedCertificateStepProps {
	/** Case data from TanStack Query — contains certificates array */
	caseData: Record<string, unknown> | null;
	/** Case ID for URL construction */
	caseId: number;
	/** Callback to trigger workflow action (generate_certificate) */
	onAction: (action: string) => void;
	/** When true, the (re)generate action is disabled — used to lock a completed
	 * case down for non-admins. */
	lockActions?: boolean;
	/** Tooltip shown on the locked (re)generate button. */
	lockMessage?: string;
}

/**
 * Certificate step — before generation shows a live preview of every certificate
 * that will be produced (one per group of up to five bags). After generation it
 * shows each generated certificate PDF, with a control to regenerate them all
 * from the current grouping.
 */
export const UnsignedCertificateStep = ({
	caseData,
	caseId,
	onAction,
	lockActions = false,
	lockMessage,
}: UnsignedCertificateStepProps) => {
	const [isGenerating, setIsGenerating] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const certificates = Array.isArray(caseData?.certificates)
		? (caseData.certificates as Certificate[])
		: [];
	// A certificate is considered generated once its PDF is available.
	const generatedCerts = certificates.filter(
		(c) => !!c.pdf_url || !!c.pdf_file
	);
	const hasGenerated = generatedCerts.length > 0;

	// Reset the generating state once the certificate set changes (generation or
	// regeneration completes — regeneration replaces certs, so ids change).
	const certSignature = generatedCerts.map((c) => c.id).join(",");

	useEffect(() => {
		// Reset generating state when certs change (generation completed).
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsGenerating(false);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
	}, [certSignature]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	const handleGenerate = () => {
		if (!caseId || isGenerating) return;
		setIsGenerating(true);
		// Safety: clear the spinner if the certificate set never updates.
		timeoutRef.current = setTimeout(() => setIsGenerating(false), 30_000);
		onAction("generate_certificate");
	};

	// ============================================================================
	// POST-GENERATION: show each certificate PDF + regenerate
	// ============================================================================
	if (hasGenerated) {
		const invoiceNumber =
			typeof caseData?.batch_invoice_raised_number === "string"
				? caseData.batch_invoice_raised_number
				: null;
		return (
			<div className="space-y-4">
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3 text-center">
					<p className="text-sm text-emerald-800 dark:text-emerald-200">
						{generatedCerts.length === 1
							? "1 certificate generated."
							: `${generatedCerts.length} certificates generated.`}{" "}
						The botanist signs each printed copy by hand.
					</p>
					{invoiceNumber && (
						<p className="mt-1 text-sm font-medium text-emerald-900 dark:text-emerald-100">
							Invoice raised: {invoiceNumber}
						</p>
					)}
				</div>

				<GeneratedCertificatesViewer
					caseId={caseId}
					certificates={generatedCerts}
				/>

				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={handleGenerate}
						disabled={isGenerating || lockActions}
						aria-busy={isGenerating}
						title={lockActions ? lockMessage : undefined}
						className="min-w-[220px]"
					>
						{isGenerating ? (
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-5 w-5" />
						)}
						{isGenerating
							? "Regenerating..."
							: generatedCerts.length === 1
								? "Regenerate Certificate"
								: "Regenerate Certificates"}
					</Button>
				</div>
			</div>
		);
	}

	// ============================================================================
	// PRE-GENERATION: live preview of every certificate + generate
	// ============================================================================
	return (
		<div className="space-y-6">
			<WizardPreviewPanel caseData={caseData} />

			<div className="flex flex-col items-center gap-3">
				<Button
					type="button"
					size="lg"
					onClick={handleGenerate}
					disabled={isGenerating || !caseId || lockActions}
					aria-busy={isGenerating}
					aria-disabled={isGenerating || !caseId || lockActions}
					title={lockActions ? lockMessage : undefined}
					className="min-w-[280px] h-12 text-base bg-blue-600 hover:bg-blue-700"
				>
					{isGenerating ? (
						<Loader2 className="mr-2 h-5 w-5 animate-spin" />
					) : (
						<FileText className="mr-2 h-5 w-5" />
					)}
					{isGenerating ? "Generating..." : "Generate Certificates"}
				</Button>
				<p className="text-sm text-muted-foreground text-center max-w-md">
					Review each certificate above. When you are satisfied, generate the
					certificate PDFs — one per group of up to five bags.
				</p>
			</div>
		</div>
	);
};
