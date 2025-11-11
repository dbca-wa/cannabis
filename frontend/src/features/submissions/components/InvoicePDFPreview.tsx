import React, { useEffect, useState, useCallback } from "react";
import { Loader, FileText, AlertCircle } from "lucide-react";
import {
	generateInvoiceHTML,
	generateInvoiceData,
} from "@/features/submissions/utils/invoiceTemplate";
import { useSystemSettings } from "@/shared/hooks/data/useSystemSettings";
import { cn } from "@/shared/utils/style.utils";
import type { Submission } from "@/shared/types/backend-api.types";

interface InvoicePDFPreviewProps {
	submission: Submission;
	className?: string;
}

export const InvoicePDFPreview: React.FC<InvoicePDFPreviewProps> = ({
	submission,
	className,
}) => {
	const { data: systemSettings, isLoading: isLoadingSettings } =
		useSystemSettings();
	const [htmlPreview, setHtmlPreview] = useState<string>("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Generate HTML preview when submission or settings change
	const generatePreview = useCallback(async () => {
		if (!systemSettings) {
			setHtmlPreview("");
			return;
		}

		setIsGenerating(true);
		setError(null);

		try {
			const invoiceData = generateInvoiceData(submission, systemSettings);
			const html = generateInvoiceHTML(invoiceData);
			setHtmlPreview(html);
		} catch (err) {
			console.error("Failed to generate invoice preview:", err);
			setError("Failed to generate invoice preview");
		} finally {
			setIsGenerating(false);
		}
	}, [submission, systemSettings]);

	// Regenerate preview when data changes
	useEffect(() => {
		generatePreview();
	}, [generatePreview]);

	// Show loading state while fetching settings
	if (isLoadingSettings) {
		return (
			<div
				className={cn(
					"flex flex-col items-center justify-center p-8 text-center",
					className
				)}
			>
				<Loader className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
				<h3 className="text-lg font-medium mb-2">Loading Settings</h3>
				<p className="text-sm text-muted-foreground max-w-md">
					Fetching pricing configuration...
				</p>
			</div>
		);
	}

	// Show placeholder if no settings available
	if (!systemSettings) {
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
					Unable to load system settings. Please try again.
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
						<p className="text-sm text-muted-foreground">{error}</p>
					</div>
				) : isGenerating ? (
					<div className="flex flex-col items-center justify-center h-full">
						<Loader className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
						<h3 className="text-lg font-medium mb-2">
							Generating Preview
						</h3>
						<p className="text-sm text-muted-foreground">
							Please wait...
						</p>
					</div>
				) : (
					<div
						className="bg-white shadow-lg mx-auto"
						style={{
							width: "210mm",
							minHeight: "297mm",
							padding: "0",
						}}
						dangerouslySetInnerHTML={{ __html: htmlPreview }}
					/>
				)}
			</div>
		</div>
	);
};
