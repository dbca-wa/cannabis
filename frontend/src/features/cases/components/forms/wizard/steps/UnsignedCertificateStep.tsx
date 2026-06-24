/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import { FileText, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { WizardPreviewPanel } from "../WizardPreviewPanel";
import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";

interface CertificateRecord {
	id: number;
	certificate_number?: string;
	unsigned_pdf_file?: string | null;
}

interface UnsignedCertificateStepProps {
	/** Case data from TanStack Query — contains certificates array */
	caseData: Record<string, unknown> | null;
	/** Case ID for URL construction */
	caseId: number;
	/** Callback to trigger workflow action (generate_certificate) */
	onAction: (action: string) => void;
}

/**
 * Unsigned Certificate Step (Step 2) — shows preview before generation,
 * shows PDF after generation. Handles the generate/regenerate flow.
 */
export const UnsignedCertificateStep = ({
	caseData,
	caseId,
	onAction,
}: UnsignedCertificateStepProps) => {
	const [isGenerating, setIsGenerating] = useState(false);
	const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [fetchVersion, setFetchVersion] = useState(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Detect existing certificate
	const certificates = Array.isArray(caseData?.certificates)
		? (caseData.certificates as CertificateRecord[])
		: [];
	const hasCertificate =
		certificates.length > 0 && !!certificates[0]?.unsigned_pdf_file;
	const certId = certificates[0]?.id;

	// Fetch PDF as blob when certificate exists or version changes (regeneration)
	useEffect(() => {
		if (!hasCertificate || !certId || !caseId) {
			setPdfBlobUrl(null);
			return;
		}

		let cancelled = false;
		const fetchPdf = async () => {
			try {
				setPdfError(null);
				const blob = await apiClient.getBlob(
					`${ENDPOINTS.CASES.DOCUMENTS.CERTIFICATE_PDF(caseId, certId)}?version=unsigned`
				);
				if (!cancelled) {
					const url = URL.createObjectURL(blob);
					setPdfBlobUrl(url);
					setIsGenerating(false);
				}
			} catch {
				if (!cancelled) {
					setPdfError("Failed to load certificate PDF");
					setIsGenerating(false);
				}
			}
		};

		fetchPdf();

		return () => {
			cancelled = true;
			if (pdfBlobUrl) {
				URL.revokeObjectURL(pdfBlobUrl);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasCertificate, certId, caseId, fetchVersion]);

	// Reset isGenerating when certificates first appear (initial generation)
	useEffect(() => {
		if (hasCertificate && isGenerating && !pdfBlobUrl) {
			// PDF fetch effect will handle the reset once it loads
			setFetchVersion((v) => v + 1);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasCertificate]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			if (pdfBlobUrl) {
				URL.revokeObjectURL(pdfBlobUrl);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleGenerate = () => {
		if (!caseId || isGenerating) return;
		setIsGenerating(true);
		setPdfBlobUrl(null);

		// Fallback timeout — reset after 30s if certificates never update
		timeoutRef.current = setTimeout(() => {
			setIsGenerating(false);
		}, 30_000);

		onAction("generate_certificate");

		// For regeneration: after a short delay, bump fetchVersion to re-fetch the PDF
		// (since caseData.certificates won't change — same cert ID)
		if (hasCertificate) {
			setTimeout(() => {
				setFetchVersion((v) => v + 1);
			}, 3000); // Wait 3s for backend to finish regenerating
		}
	};

	// ============================================================================
	// POST-GENERATION: Show PDF + Regenerate button
	// ============================================================================
	if (hasCertificate && certId) {
		return (
			<div className="space-y-4">
				{/* Note about certification date */}
				<div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-center">
					<p className="text-sm text-amber-800 dark:text-amber-200">
						This is the <strong>unsigned</strong> certificate. The certification
						date and botanist signature will be added during the Botanist
						Sign-Off step.
					</p>
				</div>

				{/* PDF display */}
				<div
					className="w-full rounded-lg border border-border overflow-hidden shadow-lg"
					style={{ height: "80vh" }}
				>
					{pdfBlobUrl ? (
						<iframe
							src={pdfBlobUrl}
							title="Unsigned Certificate PDF Preview"
							className="w-full h-full"
							style={{ border: "none" }}
						/>
					) : pdfError ? (
						<div className="flex items-center justify-center h-full">
							<p className="text-red-600">{pdfError}</p>
						</div>
					) : (
						<div className="flex items-center justify-center h-full">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					)}
				</div>

				{/* Regenerate button */}
				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={handleGenerate}
						disabled={isGenerating}
						aria-busy={isGenerating}
						className="min-w-[220px]"
					>
						{isGenerating ? (
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-5 w-5" />
						)}
						{isGenerating ? "Regenerating..." : "Regenerate Certificate"}
					</Button>
				</div>
			</div>
		);
	}

	// ============================================================================
	// PRE-GENERATION: Show live preview + Generate button
	// ============================================================================
	return (
		<div className="space-y-6">
			{/* Live certificate preview */}
			<WizardPreviewPanel caseData={caseData} />

			{/* Generate button — centred and prominent */}
			<div className="flex flex-col items-center gap-3">
				<Button
					type="button"
					size="lg"
					onClick={handleGenerate}
					disabled={isGenerating || !caseId}
					aria-busy={isGenerating}
					aria-disabled={isGenerating || !caseId}
					className="min-w-[280px] h-12 text-base bg-blue-600 hover:bg-blue-700"
				>
					{isGenerating ? (
						<Loader2 className="mr-2 h-5 w-5 animate-spin" />
					) : (
						<FileText className="mr-2 h-5 w-5" />
					)}
					{isGenerating ? "Generating..." : "Generate Unsigned Certificate"}
				</Button>
				<p className="text-sm text-muted-foreground text-center max-w-md">
					Review the preview above. When you are satisfied, click to generate
					the official unsigned certificate PDF.
				</p>
			</div>
		</div>
	);
};
