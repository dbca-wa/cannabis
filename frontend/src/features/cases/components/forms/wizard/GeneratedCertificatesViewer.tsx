import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import { Button } from "@/shared/components/ui/button";
import type { Certificate } from "@/features/certificates/types/certificates.types";
import { CertificateNavigator } from "./CertificateNavigator";

// Configure the pdf.js worker once. Vite resolves "?url" to the emitted asset
// URL at build time (the plain new URL(...) form does not resolve package paths).
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.1;

interface GeneratedCertificatesViewerProps {
	caseId: number;
	certificates: Certificate[];
}

/**
 * Displays the generated certificate PDFs for a case using react-pdf, so the
 * zoom level is controlled directly (defaults to fitting the page width, "100%")
 * and persists when paging between certificates. When a case produces more than
 * one certificate (more than five bags) a navigator pages between them.
 */
export const GeneratedCertificatesViewer = ({
	caseId,
	certificates,
}: GeneratedCertificatesViewerProps) => {
	const [active, setActive] = useState(0);
	const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
	const [pdfError, setPdfError] = useState<string | null>(null);
	// Zoom multiplier relative to fit-width. 1 = 100% (fills the available width)
	// and is kept across certificate changes.
	const [scale, setScale] = useState(1);
	const [numPages, setNumPages] = useState(0);

	const scrollRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);

	const safeActive = Math.min(active, certificates.length - 1);
	const activeCert = certificates[safeActive];
	const activeCertId = activeCert?.id;

	// Track the available width so pages render fit-to-width at 100%.
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const update = () => setContainerWidth(el.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!activeCertId || !caseId) {
			return;
		}
		let cancelled = false;
		// Reset state before fetch — intentional synchronous reset to clear stale
		// data while the new PDF loads. Not a cascading render issue.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPdfData(null);
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPdfError(null);
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setNumPages(0);

		apiClient
			.getBlob(ENDPOINTS.CASES.DOCUMENTS.CERTIFICATE_PDF(caseId, activeCertId))
			.then((blob) => blob.arrayBuffer())
			.then((buffer) => {
				if (!cancelled) setPdfData(new Uint8Array(buffer));
			})
			.catch(() => {
				if (!cancelled) setPdfError("Failed to load certificate PDF");
			});

		return () => {
			cancelled = true;
		};
	}, [caseId, activeCertId]);

	const pageWidth =
		containerWidth > 0
			? Math.max(240, (containerWidth - 32) * scale)
			: undefined;

	// Hand pdf.js the bytes in-memory so it never fetches a blob: URL — the CSP
	// connect-src directive blocks blob: connections, which broke the viewer.
	// Memoised so the document only reloads when the certificate changes.
	const file = useMemo(() => (pdfData ? { data: pdfData } : null), [pdfData]);

	const zoomOut = () =>
		setScale((s) =>
			Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 10) / 10)
		);
	const zoomIn = () =>
		setScale((s) =>
			Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 10) / 10)
		);

	const spinner = (
		<div className="flex h-full items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	);

	return (
		<div className="space-y-3">
			{certificates.length > 1 && (
				<div className="flex justify-center">
					<CertificateNavigator
						count={certificates.length}
						activeIndex={safeActive}
						onChange={(i) => setActive(i)}
						labels={certificates.map(
							(c, i) => c.certificate_number || `Certificate ${i + 1}`
						)}
					/>
				</div>
			)}

			<div
				className="flex w-full flex-col overflow-hidden rounded-lg border border-border shadow-lg"
				style={{ height: "80vh" }}
			>
				{/* Zoom toolbar */}
				<div className="flex items-center justify-end gap-1 border-b border-border bg-muted/40 px-3 py-1.5">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 cursor-pointer"
						onClick={zoomOut}
						disabled={scale <= MIN_SCALE}
						aria-label="Zoom out"
					>
						<ZoomOut className="h-4 w-4" />
					</Button>
					<span className="w-12 text-center text-sm tabular-nums text-muted-foreground">
						{Math.round(scale * 100)}%
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 cursor-pointer"
						onClick={zoomIn}
						disabled={scale >= MAX_SCALE}
						aria-label="Zoom in"
					>
						<ZoomIn className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="cursor-pointer"
						onClick={() => setScale(1)}
						aria-label="Reset zoom to 100%"
					>
						<RotateCcw className="mr-1 h-3.5 w-3.5" />
						100%
					</Button>
				</div>

				{/* Scrollable PDF area */}
				<div ref={scrollRef} className="flex-1 overflow-auto bg-muted/20 p-4">
					{file ? (
						<div className="flex flex-col items-center">
							<Document
								file={file}
								onLoadSuccess={({ numPages: n }) => setNumPages(n)}
								onLoadError={() =>
									setPdfError("Failed to load certificate PDF")
								}
								loading={spinner}
								error={
									<div className="flex h-full items-center justify-center">
										<p className="text-red-600">
											Failed to load certificate PDF
										</p>
									</div>
								}
							>
								{Array.from({ length: numPages }, (_, i) => (
									<Page
										key={`${activeCertId}-${i}`}
										pageNumber={i + 1}
										width={pageWidth}
										renderTextLayer={false}
										renderAnnotationLayer={false}
										className="mb-4 bg-white shadow-md"
									/>
								))}
							</Document>
						</div>
					) : pdfError ? (
						<div className="flex h-full items-center justify-center">
							<p className="text-red-600">{pdfError}</p>
						</div>
					) : (
						spinner
					)}
				</div>
			</div>
		</div>
	);
};
