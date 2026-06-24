/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Loader2, PenTool, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import {
	useSignature,
	useSignatureImage,
	useSignCertificate,
	useUnlockCertificate,
} from "@/features/signatures/hooks";
import { SignatureManager } from "@/features/signatures/components/SignatureManager";

interface CertificateRecord {
	id: number;
	certificate_number?: string;
	unsigned_pdf_file?: string | null;
	signed_pdf_file?: string | null;
	is_locked: boolean;
}

interface BotanistSignOffStepProps {
	/** Case data from TanStack Query — contains certificates array */
	caseData: Record<string, unknown> | null;
	/** Case ID for URL construction */
	caseId: number;
	/** Callback to trigger workflow action */
	onAction: (action: string) => void;
}

/**
 * Botanist Sign-Off Step (Step 3) — manages the three-state flow for
 * digitally signing an unsigned certificate PDF.
 */
export const BotanistSignOffStep = ({
	caseData,
	caseId,
}: BotanistSignOffStepProps) => {
	// Detect existing certificate
	const certificates = Array.isArray(caseData?.certificates)
		? (caseData.certificates as CertificateRecord[])
		: [];
	const certId = certificates[0]?.id;
	const isAlreadySigned = certificates[0]?.is_locked === true;

	// View state machine
	const [viewState, setViewState] = useState<
		"default" | "confirmation" | "signed"
	>(isAlreadySigned ? "signed" : "default");

	// PDF fetch state
	const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [pdfLoading, setPdfLoading] = useState(false);

	// Signing state
	const [isSigning, setIsSigning] = useState(false);

	// Signature modal state
	const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

	// Signature prerequisite check
	const { data: signature } = useSignature();
	const hasSignature = !!signature?.image_url;

	// Signature image for confirmation preview
	const { blobUrl: signatureBlobUrl, isLoading: signatureImageLoading } =
		useSignatureImage(hasSignature, signature?.updated_at);

	// Certificate signing mutation
	const signCertificateMutation = useSignCertificate();

	// Certificate unlock mutation (for re-signing)
	const unlockCertificateMutation = useUnlockCertificate();

	// Fetch unsigned PDF as blob when certificate exists
	useEffect(() => {
		if (!certId || !caseId) {
			setPdfBlobUrl(null);
			return;
		}

		let cancelled = false;
		setPdfLoading(true);
		setPdfError(null);

		const fetchPdf = async () => {
			try {
				const blob = await apiClient.getBlob(
					ENDPOINTS.CASES.DOCUMENTS.CERTIFICATE_PDF(caseId, certId)
				);
				if (!cancelled) {
					const url = URL.createObjectURL(blob);
					setPdfBlobUrl(url);
				}
			} catch {
				if (!cancelled) {
					setPdfError("Failed to load certificate PDF");
				}
			} finally {
				if (!cancelled) {
					setPdfLoading(false);
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
	}, [certId, caseId, viewState]);

	// Cleanup blob URL on unmount
	useEffect(() => {
		return () => {
			if (pdfBlobUrl) {
				URL.revokeObjectURL(pdfBlobUrl);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Close signature modal when a valid signature is detected after upload
	useEffect(() => {
		if (hasSignature && isSignatureModalOpen) {
			setIsSignatureModalOpen(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasSignature]);

	// Handle the certificate signing action
	const handleSignCertificate = async () => {
		if (!certId || isSigning) return;
		setIsSigning(true);
		try {
			await signCertificateMutation.mutateAsync({
				submissionId: caseId,
				certificateId: certId,
			});
			setViewState("signed");
		} catch {
			// Error toast is handled by the hook's onError callback
		} finally {
			setIsSigning(false);
		}
	};

	// Handle re-signing: unlock the certificate, then go back to confirmation flow
	const [isUnlocking, setIsUnlocking] = useState(false);
	const handleResign = async () => {
		if (!certId || isUnlocking) return;
		setIsUnlocking(true);
		try {
			await unlockCertificateMutation.mutateAsync({
				submissionId: caseId,
				certificateId: certId,
			});
			setViewState("confirmation");
		} catch {
			// Error toast handled by hook
		} finally {
			setIsUnlocking(false);
		}
	};

	// ============================================================================
	// GUARD: No certificate exists — prompt user to complete Step 2
	// ============================================================================
	if (certificates.length === 0) {
		return (
			<div className="flex items-center justify-center py-16">
				<p className="text-muted-foreground text-center">
					No certificate found. Please complete Step 2 (Generate Certificate)
					first.
				</p>
			</div>
		);
	}

	// ============================================================================
	// CONFIRMATION VIEW — PDF with signature overlay for true preview
	// ============================================================================
	if (viewState === "confirmation") {
		const today = new Date().toLocaleDateString("en-AU", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});

		return (
			<div className="space-y-4">
				{/* PDF with signature overlay */}
				<div
					className="relative w-full rounded-lg border border-border overflow-hidden shadow-lg"
					style={{ height: "80vh" }}
				>
					{/* Unsigned PDF as background */}
					{pdfBlobUrl ? (
						<iframe
							src={pdfBlobUrl}
							title="Certificate PDF — signature preview"
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

					{/* Signature overlay — positioned at bottom-left to match PDF layout */}
					<div className="absolute bottom-6 left-6 right-6 pointer-events-none">
						<div className="bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-lg border-2 border-blue-300 dark:border-blue-700 p-4 shadow-lg max-w-sm">
							<p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
								Signature Preview
							</p>
							{/* Signature image */}
							<div className="mb-2">
								{signatureImageLoading ? (
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								) : signatureBlobUrl ? (
									<img
										src={signatureBlobUrl}
										alt="Your digital signature"
										className="max-h-16 object-contain"
									/>
								) : (
									<p className="text-sm text-muted-foreground">
										Signature not available
									</p>
								)}
							</div>
							{/* Signature line */}
							<div className="border-t-2 border-foreground/60 pt-1 mb-2">
								<span className="text-xs font-bold text-foreground">
									Signature of Approved Botanist
								</span>
							</div>
							{/* Certification date */}
							<p className="text-xs text-foreground">
								Certified on <strong>{today}</strong> at the{" "}
								<strong>WA Herbarium, Kensington</strong>
							</p>
						</div>
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex justify-center gap-3">
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={() => setViewState("default")}
						disabled={isSigning}
						aria-label="Cancel signing"
						className="min-w-[140px]"
					>
						Cancel
					</Button>

					<Button
						type="button"
						size="lg"
						onClick={handleSignCertificate}
						disabled={isSigning}
						aria-label="Confirm and sign certificate"
						aria-busy={isSigning}
						className="min-w-[180px] bg-blue-600 hover:bg-blue-700"
					>
						{isSigning ? (
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
						) : (
							<ShieldCheck className="mr-2 h-5 w-5" />
						)}
						{isSigning ? "Signing..." : "Confirm & Sign"}
					</Button>
				</div>
			</div>
		);
	}

	// ============================================================================
	// SIGNED VIEW — Signed PDF display with success banner
	// ============================================================================
	if (viewState === "signed") {
		return (
			<div className="space-y-4">
				{/* Success banner */}
				<div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-3 text-center">
					<p className="text-sm text-green-800 dark:text-green-200">
						Certificate has been <strong>signed successfully</strong>.
					</p>
				</div>

				{/* Signed PDF display */}
				<div
					className="w-full rounded-lg border border-border overflow-hidden shadow-lg"
					style={{ height: "80vh" }}
				>
					{pdfBlobUrl ? (
						<iframe
							src={pdfBlobUrl}
							title="Signed Certificate PDF"
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

				{/* Re-sign button */}
				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={handleResign}
						disabled={isUnlocking}
						aria-busy={isUnlocking}
						className="min-w-[220px]"
					>
						{isUnlocking ? (
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-5 w-5" />
						)}
						{isUnlocking ? "Unlocking..." : "Re-sign Certificate"}
					</Button>
				</div>
			</div>
		);
	}

	// ============================================================================
	// DEFAULT VIEW: Unsigned PDF display + action buttons
	// ============================================================================
	return (
		<div className="space-y-4" aria-busy={pdfLoading}>
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

			{/* Action buttons */}
			<div className="flex justify-center gap-3">
				{!hasSignature && (
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={() => setIsSignatureModalOpen(true)}
						aria-label="Add Signature"
						className="min-w-[180px]"
					>
						<PenTool className="mr-2 h-5 w-5" />
						Add Signature
					</Button>
				)}

				<Button
					type="button"
					size="lg"
					onClick={() => setViewState("confirmation")}
					disabled={!hasSignature}
					aria-label="Sign Certificate"
					aria-disabled={!hasSignature}
					className="min-w-[200px] bg-blue-600 hover:bg-blue-700"
				>
					<ShieldCheck className="mr-2 h-5 w-5" />
					Sign Certificate
				</Button>
			</div>

			{!hasSignature && (
				<p className="text-sm text-muted-foreground text-center">
					You must add a digital signature before you can sign the certificate.
				</p>
			)}

			{/* Signature Modal (placeholder Dialog wrapping SignatureManager) */}
			<Dialog
				open={isSignatureModalOpen}
				onOpenChange={setIsSignatureModalOpen}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Manage Signature</DialogTitle>
					</DialogHeader>
					<SignatureManager />
				</DialogContent>
			</Dialog>
		</div>
	);
};
