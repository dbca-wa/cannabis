import { observer } from "mobx-react-lite";
import { type Case } from "@/shared/types/backend-api.types";
import {
	FileText,
	Receipt,
	Download,
	AlertCircle,
	CheckCircle2,
	Loader,
	Eye,
	RefreshCw,
	Lock,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/shared/components/ui/tooltip";
import { CertificatePDFPreview } from "@/features/cases/components/CertificatePDFPreview";
import { InvoicePDFPreview } from "@/features/cases/components/InvoicePDFPreview";
import { useDocumentGeneration } from "@/features/cases/hooks/useDocumentGeneration";
import { formatDate } from "@/shared/utils/date.utils";

interface DocumentsPhaseContentProps {
	caseObj: Case;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Case>) => Promise<void>;
}

/**
 * Documents Phase Content Component
 *
 * Displays two-column layout for Certificate and Invoice generation.
 * - Certificate preview and generation
 * - Invoice preview and generation
 * - View PDF in new tab / download links
 * - Generation timestamps
 * - Combined "Generate All Documents" button
 */
export const DocumentsPhaseContent = observer<DocumentsPhaseContentProps>(
	({ caseObj, isCurrentPhase, canEdit }) => {
		const {
			generateCertificate,
			regenerateCertificate,
			isGeneratingCertificate,
			isRegeneratingCertificate,
			viewCertificatePdf,
			generateInvoice,
			regenerateInvoice,
			isGeneratingInvoice,
			isRegeneratingInvoice,
			viewInvoicePdf,
		} = useDocumentGeneration(caseObj.id);

		// Check if documents have been generated
		const hasCertificate = !!caseObj.certificates?.length;
		const hasInvoice = !!caseObj.invoices?.length;
		const certificate = caseObj.certificates?.[0];
		const invoice = caseObj.invoices?.[0];

		// Certificate lock state
		const isCertificateLocked = certificate?.is_locked ?? false;

		// Combined loading state for "Generate All"
		const isGeneratingAll = isGeneratingCertificate || isGeneratingInvoice;

		// Handle certificate generation
		const handleGenerateCertificate = () => {
			generateCertificate();
		};

		// Handle certificate regeneration
		const handleRegenerateCertificate = () => {
			if (certificate) {
				regenerateCertificate(certificate.id);
			}
		};

		// Handle invoice generation
		const handleGenerateInvoice = () => {
			// Use existing invoice customer_number if available, otherwise use case_number as fallback
			const customerNumber = invoice?.customer_number || caseObj.case_number;
			generateInvoice(customerNumber);
		};

		// Handle invoice regeneration
		const handleRegenerateInvoice = () => {
			if (invoice) {
				regenerateInvoice({ invoiceId: invoice.id });
			}
		};

		// Handle generate all documents
		const handleGenerateAll = () => {
			if (!hasCertificate) {
				generateCertificate();
			}
			if (!hasInvoice) {
				const customerNumber = invoice?.customer_number || caseObj.case_number;
				generateInvoice(customerNumber);
			}
		};

		// Handle viewing certificate PDF in new tab
		const handleViewCertificate = () => {
			if (certificate) {
				viewCertificatePdf(certificate.id);
			}
		};

		// Handle viewing invoice PDF in new tab
		const handleViewInvoice = () => {
			if (invoice) {
				viewInvoicePdf(invoice.id);
			}
		};

		// Handle document download (fallback for pdf_url direct links)
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
									Generate certificate and invoice documents for this caseObj.
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
											{/* View Certificate PDF */}
											<Button
												variant="outline"
												className="w-full"
												onClick={handleViewCertificate}
												disabled={!certificate?.unsigned_pdf_file}
											>
												<Eye className="mr-2 h-4 w-4" />
												View Certificate
											</Button>

											{/* Download Link (fallback) */}
											{certificate?.pdf_url && (
												<Button
													variant="outline"
													className="w-full"
													onClick={() =>
														handleDownload(
															certificate.pdf_url!,
															`certificate_${caseObj.case_number}.pdf`
														)
													}
												>
													<Download className="mr-2 h-4 w-4" />
													Download Certificate
												</Button>
											)}

											{/* Generation Timestamp */}
											{certificate?.created_at && (
												<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
													Generated on{" "}
													{new Date(certificate.created_at).toLocaleString()}
												</p>
											)}

											{/* Regenerate Button — disabled when locked */}
											{isCertificateLocked ? (
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="w-full inline-block">
															<Button
																variant="ghost"
																size="sm"
																className="w-full"
																disabled
															>
																<Lock className="mr-2 h-3 w-3" />
																Regenerate Certificate
															</Button>
														</span>
													</TooltipTrigger>
													<TooltipContent>
														Certificate is locked after signing and cannot be
														regenerated
													</TooltipContent>
												</Tooltip>
											) : (
												<Button
													variant="ghost"
													size="sm"
													className="w-full"
													onClick={handleRegenerateCertificate}
													disabled={isRegeneratingCertificate}
												>
													{isRegeneratingCertificate ? (
														<>
															<Loader className="mr-2 h-3 w-3 animate-spin" />
															Regenerating...
														</>
													) : (
														<>
															<RefreshCw className="mr-2 h-3 w-3" />
															Regenerate Certificate
														</>
													)}
												</Button>
											)}
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
										<InvoicePDFPreview caseObj={caseObj} />
									</div>
								</div>

								{/* Invoice Actions */}
								<div className="space-y-2">
									{hasInvoice ? (
										<>
											{/* View Invoice PDF */}
											<Button
												variant="outline"
												className="w-full"
												onClick={handleViewInvoice}
												disabled={!invoice?.pdf_file}
											>
												<Eye className="mr-2 h-4 w-4" />
												View Invoice
											</Button>

											{/* Download Link (fallback) */}
											{invoice?.pdf_url && (
												<Button
													variant="outline"
													className="w-full"
													onClick={() =>
														handleDownload(
															invoice.pdf_url!,
															`invoice_${caseObj.case_number}.pdf`
														)
													}
												>
													<Download className="mr-2 h-4 w-4" />
													Download Invoice
												</Button>
											)}

											{/* Generation Timestamp */}
											{invoice?.created_at && (
												<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
													Generated on{" "}
													{new Date(invoice.created_at).toLocaleString()}
												</p>
											)}

											{/* Regenerate Button */}
											<Button
												variant="ghost"
												size="sm"
												className="w-full"
												onClick={handleRegenerateInvoice}
												disabled={isRegeneratingInvoice}
											>
												{isRegeneratingInvoice ? (
													<>
														<Loader className="mr-2 h-3 w-3 animate-spin" />
														Regenerating...
													</>
												) : (
													<>
														<RefreshCw className="mr-2 h-3 w-3" />
														Regenerate Invoice
													</>
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
										Both certificate and invoice must be generated before
										advancing to the next phase.
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
									This is a read-only view. The case has moved to{" "}
									{caseObj.phase_display}.
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
									<p className="text-sm font-medium">Certificate</p>
									{certificate?.created_at && (
										<p className="text-xs text-gray-500">
											Generated on {formatDate(certificate.created_at)}
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
										{certificate?.unsigned_pdf_file && (
											<Button
												variant="outline"
												size="sm"
												onClick={handleViewCertificate}
											>
												<Eye className="mr-2 h-3 w-3" />
												View
											</Button>
										)}
									</>
								) : (
									<Badge variant="secondary">Not Generated</Badge>
								)}
							</div>
						</div>

						{/* Invoice Status */}
						<div className="flex items-center justify-between p-3 border rounded-lg">
							<div className="flex items-center gap-3">
								<Receipt className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium">Invoice</p>
									{invoice?.created_at && (
										<p className="text-xs text-gray-500">
											Generated on {formatDate(invoice.created_at)}
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
										{invoice?.pdf_file && (
											<Button
												variant="outline"
												size="sm"
												onClick={handleViewInvoice}
											>
												<Eye className="mr-2 h-3 w-3" />
												View
											</Button>
										)}
									</>
								) : (
									<Badge variant="secondary">Not Generated</Badge>
								)}
							</div>
						</div>

						{/* Documents Generated Timestamp */}
						{caseObj.documents_generated_at && (
							<div className="pt-3 border-t">
								<p className="text-sm text-gray-500">
									Documents generated on{" "}
									{new Date(caseObj.documents_generated_at).toLocaleString()}
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
