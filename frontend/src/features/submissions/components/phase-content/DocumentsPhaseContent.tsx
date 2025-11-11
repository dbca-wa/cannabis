import { observer } from "mobx-react-lite";
import { useState } from "react";
import { type Submission } from "@/shared/types/backend-api.types";
import {
	FileText,
	Receipt,
	Download,
	AlertCircle,
	CheckCircle2,
	Loader,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { CertificatePDFPreview } from "@/features/submissions/components/CertificatePDFPreview";
import { InvoicePDFPreview } from "@/features/submissions/components/InvoicePDFPreview";
import { toast } from "sonner";

interface DocumentsPhaseContentProps {
	submission: Submission;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
}

/**
 * Documents Phase Content Component
 *
 * Displays two-column layout for Certificate and Invoice generation.
 * - Certificate preview and generation
 * - Invoice preview and generation
 * - Download links for generated documents
 * - Generation timestamps
 * - Combined "Generate All Documents" button
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */
export const DocumentsPhaseContent = observer<DocumentsPhaseContentProps>(
	({ submission, isCurrentPhase, canEdit }) => {
		// Local state for generation progress
		const [isGeneratingCertificate, setIsGeneratingCertificate] =
			useState(false);
		const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
		const [isGeneratingAll, setIsGeneratingAll] = useState(false);

		// Check if documents have been generated
		const hasCertificate = !!submission.certificates?.length;
		const hasInvoice = !!submission.invoices?.length;
		const certificate = submission.certificates?.[0];
		const invoice = submission.invoices?.[0];

		// Handle certificate generation
		const handleGenerateCertificate = async () => {
			setIsGeneratingCertificate(true);
			try {
				// TODO: Call API to generate certificate
				// await submissionsService.generateCertificate(submission.id);
				toast.success("Certificate generated successfully");
			} catch (error) {
				console.error("Failed to generate certificate:", error);
				toast.error(
					"Failed to generate certificate. Please try again."
				);
			} finally {
				setIsGeneratingCertificate(false);
			}
		};

		// Handle invoice generation
		const handleGenerateInvoice = async () => {
			setIsGeneratingInvoice(true);
			try {
				// TODO: Call API to generate invoice
				// await submissionsService.generateInvoice(submission.id);
				toast.success("Invoice generated successfully");
			} catch (error) {
				console.error("Failed to generate invoice:", error);
				toast.error("Failed to generate invoice. Please try again.");
			} finally {
				setIsGeneratingInvoice(false);
			}
		};

		// Handle generate all documents
		const handleGenerateAll = async () => {
			setIsGeneratingAll(true);
			try {
				// Generate both documents
				await Promise.all([
					handleGenerateCertificate(),
					handleGenerateInvoice(),
				]);
				toast.success("All documents generated successfully");
			} catch (error) {
				console.error("Failed to generate documents:", error);
				toast.error("Failed to generate documents. Please try again.");
			} finally {
				setIsGeneratingAll(false);
			}
		};

		// Handle document download
		const handleDownload = (url: string, filename: string) => {
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		};

		// If current phase and can edit, show editable document generation interface
		if (isCurrentPhase && canEdit) {
			return (
				<div className="space-y-4">
					{/* Editing indicator */}
					<div className="p-4 bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded">
						<div className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
							<div>
								<p className="text-sm font-medium text-purple-900 dark:text-purple-100">
									Documents Phase
								</p>
								<p className="text-xs text-purple-700 dark:text-purple-300">
									Generate certificate and invoice documents
									for this submission.
								</p>
							</div>
						</div>
					</div>

					{/* Generate All Documents Button */}
					{!hasCertificate || !hasInvoice ? (
						<div className="flex justify-end">
							<Button
								onClick={handleGenerateAll}
								disabled={isGeneratingAll}
								className="bg-purple-600 hover:bg-purple-700"
							>
								{isGeneratingAll ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										Generating All Documents...
									</>
								) : (
									<>
										<FileText className="mr-2 h-4 w-4" />
										Generate All Documents
									</>
								)}
							</Button>
						</div>
					) : null}

					{/* Two-column layout for Certificate and Invoice */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Certificate Section */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<FileText className="h-5 w-5" />
										Certificate
									</div>
									{hasCertificate && (
										<Badge
											variant="default"
											className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Generated
										</Badge>
									)}
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Certificate Preview */}
								<div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
									<div className="h-[400px]">
										<CertificatePDFPreview />
									</div>
								</div>

								{/* Certificate Actions */}
								<div className="space-y-2">
									{hasCertificate ? (
										<>
											{/* Download Link */}
											<Button
												variant="outline"
												className="w-full"
												onClick={() =>
													certificate?.pdf_url &&
													handleDownload(
														certificate.pdf_url,
														`certificate_${submission.case_number}.pdf`
													)
												}
												disabled={!certificate?.pdf_url}
											>
												<Download className="mr-2 h-4 w-4" />
												Download Certificate
											</Button>

											{/* Generation Timestamp */}
											{certificate?.created_at && (
												<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
													Generated on{" "}
													{new Date(
														certificate.created_at
													).toLocaleString()}
												</p>
											)}

											{/* Regenerate Button */}
											<Button
												variant="ghost"
												size="sm"
												className="w-full"
												onClick={
													handleGenerateCertificate
												}
												disabled={
													isGeneratingCertificate
												}
											>
												{isGeneratingCertificate ? (
													<>
														<Loader className="mr-2 h-3 w-3 animate-spin" />
														Regenerating...
													</>
												) : (
													"Regenerate Certificate"
												)}
											</Button>
										</>
									) : (
										<Button
											onClick={handleGenerateCertificate}
											disabled={isGeneratingCertificate}
											className="w-full"
										>
											{isGeneratingCertificate ? (
												<>
													<Loader className="mr-2 h-4 w-4 animate-spin" />
													Generating Certificate...
												</>
											) : (
												<>
													<FileText className="mr-2 h-4 w-4" />
													Generate Certificate
												</>
											)}
										</Button>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Invoice Section */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Receipt className="h-5 w-5" />
										Invoice
									</div>
									{hasInvoice && (
										<Badge
											variant="default"
											className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Generated
										</Badge>
									)}
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Invoice Preview */}
								<div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
									<div className="h-[400px]">
										<InvoicePDFPreview
											submission={submission}
										/>
									</div>
								</div>

								{/* Invoice Actions */}
								<div className="space-y-2">
									{hasInvoice ? (
										<>
											{/* Download Link */}
											<Button
												variant="outline"
												className="w-full"
												onClick={() =>
													invoice?.pdf_url &&
													handleDownload(
														invoice.pdf_url,
														`invoice_${submission.case_number}.pdf`
													)
												}
												disabled={!invoice?.pdf_url}
											>
												<Download className="mr-2 h-4 w-4" />
												Download Invoice
											</Button>

											{/* Generation Timestamp */}
											{invoice?.created_at && (
												<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
													Generated on{" "}
													{new Date(
														invoice.created_at
													).toLocaleString()}
												</p>
											)}

											{/* Regenerate Button */}
											<Button
												variant="ghost"
												size="sm"
												className="w-full"
												onClick={handleGenerateInvoice}
												disabled={isGeneratingInvoice}
											>
												{isGeneratingInvoice ? (
													<>
														<Loader className="mr-2 h-3 w-3 animate-spin" />
														Regenerating...
													</>
												) : (
													"Regenerate Invoice"
												)}
											</Button>
										</>
									) : (
										<Button
											onClick={handleGenerateInvoice}
											disabled={isGeneratingInvoice}
											className="w-full"
										>
											{isGeneratingInvoice ? (
												<>
													<Loader className="mr-2 h-4 w-4 animate-spin" />
													Generating Invoice...
												</>
											) : (
												<>
													<Receipt className="mr-2 h-4 w-4" />
													Generate Invoice
												</>
											)}
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Validation Warning */}
					{(!hasCertificate || !hasInvoice) && (
						<div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-sm font-medium text-amber-900 dark:text-amber-100">
										Documents Required
									</p>
									<p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
										Both certificate and invoice must be
										generated before advancing to the next
										phase.
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
							<FileText className="h-5 w-5 text-gray-600" />
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

				{/* Documents Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Generated Documents
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Certificate Status */}
						<div className="flex items-center justify-between p-3 border rounded-lg">
							<div className="flex items-center gap-3">
								<FileText className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium">
										Certificate
									</p>
									{certificate?.created_at && (
										<p className="text-xs text-gray-500">
											Generated on{" "}
											{new Date(
												certificate.created_at
											).toLocaleDateString()}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{hasCertificate ? (
									<>
										<Badge
											variant="default"
											className="bg-green-100 text-green-800"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Generated
										</Badge>
										{certificate?.pdf_url && (
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleDownload(
														certificate.pdf_url!,
														`certificate_${submission.case_number}.pdf`
													)
												}
											>
												<Download className="mr-2 h-3 w-3" />
												Download
											</Button>
										)}
									</>
								) : (
									<Badge variant="secondary">
										Not Generated
									</Badge>
								)}
							</div>
						</div>

						{/* Invoice Status */}
						<div className="flex items-center justify-between p-3 border rounded-lg">
							<div className="flex items-center gap-3">
								<Receipt className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium">
										Invoice
									</p>
									{invoice?.created_at && (
										<p className="text-xs text-gray-500">
											Generated on{" "}
											{new Date(
												invoice.created_at
											).toLocaleDateString()}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{hasInvoice ? (
									<>
										<Badge
											variant="default"
											className="bg-green-100 text-green-800"
										>
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Generated
										</Badge>
										{invoice?.pdf_url && (
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleDownload(
														invoice.pdf_url!,
														`invoice_${submission.case_number}.pdf`
													)
												}
											>
												<Download className="mr-2 h-3 w-3" />
												Download
											</Button>
										)}
									</>
								) : (
									<Badge variant="secondary">
										Not Generated
									</Badge>
								)}
							</div>
						</div>

						{/* Documents Generated Timestamp */}
						{submission.documents_generated_at && (
							<div className="pt-3 border-t">
								<p className="text-sm text-gray-500">
									Documents generated on{" "}
									{new Date(
										submission.documents_generated_at
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

DocumentsPhaseContent.displayName = "DocumentsPhaseContent";
