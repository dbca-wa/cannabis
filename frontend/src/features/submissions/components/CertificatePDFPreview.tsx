import React, { useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { Loader, FileText, AlertCircle } from "lucide-react";
import { useCertificatePreviewStore } from "@/features/submissions/hooks/useCertificatePreviewStore";
import { generateCertificateHTML } from "@/features/submissions/utils/certificateTemplate";
import { cn } from "@/shared/utils/style.utils";

interface CertificatePDFPreviewProps {
	className?: string;
}

export const CertificatePDFPreview: React.FC<CertificatePDFPreviewProps> =
	observer(({ className }) => {
		const previewStore = useCertificatePreviewStore();
		const [htmlPreview, setHtmlPreview] = useState<string>("");
		const [isGenerating, setIsGenerating] = useState(false);
		const [error, setError] = useState<string | null>(null);

		// Generate HTML preview when preview data changes
		const generatePreview = useCallback(async () => {
			if (!previewStore.state.previewData) {
				setHtmlPreview("");
				return;
			}

			setIsGenerating(true);
			setError(null);

			try {
				const html = generateCertificateHTML(
					previewStore.state.previewData
				);
				setHtmlPreview(html);
			} catch (err) {
				console.error("Failed to generate certificate preview:", err);
				setError("Failed to generate certificate preview");
			} finally {
				setIsGenerating(false);
			}
		}, [previewStore.state.previewData]);

		// Regenerate preview when data changes
		useEffect(() => {
			generatePreview();
		}, [generatePreview]);

		// Show placeholder if no preview data
		if (!previewStore.state.previewData) {
			return (
				<div
					className={cn(
						"flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/50",
						className
					)}
				>
					<FileText className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">
						No Preview Available
					</h3>
					<p className="text-sm text-muted-foreground max-w-md">
						Complete the required fields (Case Number, Received
						Date, and Envelope Number) to see the certificate
						preview.
					</p>
				</div>
			);
		}

		return (
			<div className={cn("w-full h-full", className)}>
				{/* Preview Area - Clean, no controls */}
				<div className="w-full h-full overflow-auto bg-gray-100 dark:bg-gray-800 p-6">
					{error ? (
						<div className="flex flex-col items-center justify-center h-full">
							<AlertCircle className="h-12 w-12 text-red-500 mb-4" />
							<h3 className="text-lg font-medium mb-2">
								Preview Error
							</h3>
							<p className="text-sm text-muted-foreground">
								{error}
							</p>
						</div>
					) : isGenerating ? (
						<div className="flex items-center justify-center h-full">
							<Loader className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : htmlPreview ? (
						<div className="flex justify-center">
							<div
								dangerouslySetInnerHTML={{
									__html: htmlPreview,
								}}
								className="shadow-lg bg-white rounded-lg overflow-hidden"
								style={{
									width: "210mm",
									minHeight: "297mm",
								}}
							/>
						</div>
					) : (
						<div className="flex items-center justify-center h-full">
							<p className="text-muted-foreground">
								No preview available
							</p>
						</div>
					)}
				</div>
			</div>
		);
	});

CertificatePDFPreview.displayName = "CertificatePDFPreview";
