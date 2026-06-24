/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import { useSystemSettings } from "@/shared/hooks/data/useSystemSettings";
import { deleteInvoice } from "@/features/cases/services/documents.service";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LineItemConfigurator } from "./LineItemConfigurator";
import type { LineItemPayload } from "./LineItemConfigurator";

interface InvoiceRecord {
	id: number;
	invoice_number?: string;
	pdf_file?: string | null;
}

interface InvoiceStepProps {
	/** Case data from TanStack Query — contains invoices array and customer_number */
	caseData: Record<string, unknown> | null;
	/** Case ID for URL construction and mutations */
	caseId: number;
	/** Callback to trigger workflow action */
	onAction: (action: string) => void;
}

interface GenerateInvoiceRequest {
	customer_number: string;
	line_items: LineItemPayload[];
	tax_enabled: boolean;
}

/**
 * Invoice Step (Step 4) — shows LineItemConfigurator before generation,
 * shows PDF after generation. Handles the generate/restart flow.
 */
export const InvoiceStep = ({
	caseData,
	caseId,
	onAction: _onAction,
}: InvoiceStepProps) => {
	const [customerNumber, setCustomerNumber] = useState("");
	const [customerNumberError, setCustomerNumberError] = useState<string | null>(
		null
	);
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationError, setGenerationError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [fetchVersion, setFetchVersion] = useState(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Preserved line item config for restart flow
	const [preservedConfig, setPreservedConfig] = useState<{
		lineItems: LineItemPayload[];
		taxEnabled: boolean;
	} | null>(null);

	const queryClient = useQueryClient();
	const {
		data: settings,
		isLoading: isLoadingSettings,
		error: settingsError,
	} = useSystemSettings();

	// Pre-populate customer number from caseData
	useEffect(() => {
		const existingCustomerNumber = caseData?.customer_number;
		if (typeof existingCustomerNumber === "string" && existingCustomerNumber) {
			setCustomerNumber(existingCustomerNumber);
		}
	}, [caseData?.customer_number]);

	// Detect existing invoice
	const invoices = Array.isArray(caseData?.invoices)
		? (caseData.invoices as InvoiceRecord[])
		: [];
	const hasInvoice = invoices.length > 0 && !!invoices[0]?.pdf_file;
	const invoiceId = invoices[0]?.id;

	// Fetch PDF as blob when invoice exists or version changes
	useEffect(() => {
		if (!hasInvoice || !invoiceId || !caseId) {
			setPdfBlobUrl(null);
			return;
		}

		let cancelled = false;
		const fetchPdf = async () => {
			try {
				setPdfError(null);
				const blob = await apiClient.getBlob(
					ENDPOINTS.CASES.DOCUMENTS.INVOICE_PDF(caseId, invoiceId)
				);
				if (!cancelled) {
					const url = URL.createObjectURL(blob);
					setPdfBlobUrl(url);
					setIsGenerating(false);
				}
			} catch {
				if (!cancelled) {
					setPdfError("Failed to load invoice PDF");
					setIsGenerating(false);
				}
			}
		};

		fetchPdf();

		return () => {
			cancelled = true;
		};
	}, [hasInvoice, invoiceId, caseId, fetchVersion]);

	// Reset isGenerating when invoices first appear
	useEffect(() => {
		if (hasInvoice && isGenerating && !pdfBlobUrl) {
			setFetchVersion((v) => v + 1);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasInvoice]);

	// Cleanup timeout and blob URLs on unmount
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

	// Handle rate update via PATCH /system/settings
	const handleRateUpdate = useCallback(
		async (rateKey: string, value: string) => {
			await apiClient.patch(ENDPOINTS.SYSTEM.SETTINGS, { [rateKey]: value });
			await queryClient.invalidateQueries({ queryKey: ["system", "settings"] });
		},
		[queryClient]
	);

	// Handle generate with full line items payload
	const handleGenerate = useCallback(
		async (lineItems: LineItemPayload[], taxEnabled: boolean) => {
			// Validate customer number
			if (!customerNumber.trim()) {
				setCustomerNumberError("Customer number is required.");
				return;
			}
			setCustomerNumberError(null);
			setGenerationError(null);
			setIsGenerating(true);
			setPdfBlobUrl(null);
			setShowForm(false);

			// Preserve the configuration for restart
			setPreservedConfig({ lineItems, taxEnabled });

			// Fallback timeout — reset after 30s if invoices never update
			timeoutRef.current = setTimeout(() => {
				setIsGenerating(false);
			}, 30_000);

			try {
				const payload: GenerateInvoiceRequest = {
					customer_number: customerNumber.trim(),
					line_items: lineItems,
					tax_enabled: taxEnabled,
				};

				await apiClient.post(
					ENDPOINTS.CASES.DOCUMENTS.GENERATE_INVOICE(caseId),
					payload
				);

				// Invalidate case queries to refresh invoice data
				await queryClient.invalidateQueries({
					predicate: (query) => {
						const key = query.queryKey;
						return Array.isArray(key) && key[0] === "cases";
					},
				});

				toast.success("Invoice generated successfully");
			} catch (error: unknown) {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}
				setIsGenerating(false);
				setShowForm(true);
				const message =
					error instanceof Error ? error.message : "Invoice generation failed";
				setGenerationError(message);
				toast.error(`Failed to generate invoice: ${message}`);
			}
		},
		[customerNumber, caseId, queryClient]
	);

	// Handle restart — delete invoice, return to configurator with preserved config
	const handleRestart = async () => {
		if (!invoiceId) return;
		try {
			await deleteInvoice(invoiceId);
			await queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === "cases";
				},
			});
		} catch {
			// If delete fails, still show the form for retry
		}
		setPdfBlobUrl(null);
		setShowForm(true);
	};

	// ============================================================================
	// POST-GENERATION: Show PDF + Restart button
	// ============================================================================
	if (hasInvoice && invoiceId && !showForm) {
		return (
			<div className="space-y-4">
				{/* PDF display */}
				<div
					className="w-full rounded-lg border border-border overflow-hidden shadow-lg"
					style={{ height: "80vh" }}
				>
					{pdfBlobUrl ? (
						<iframe
							src={pdfBlobUrl}
							title="Invoice PDF Preview"
							className="w-full h-full"
							style={{ border: "none" }}
						/>
					) : pdfError ? (
						<div
							className="flex items-center justify-center h-full"
							role="alert"
						>
							<p className="text-red-600">{pdfError}</p>
						</div>
					) : (
						<div
							className="flex items-center justify-center h-full"
							aria-busy="true"
						>
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							<span className="sr-only">Loading invoice PDF</span>
						</div>
					)}
				</div>

				{/* Restart button */}
				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={handleRestart}
						disabled={isGenerating}
						className="min-w-[220px]"
					>
						<RefreshCw className="mr-2 h-5 w-5" />
						Restart
					</Button>
				</div>
			</div>
		);
	}

	// ============================================================================
	// PRE-GENERATION: LineItemConfigurator
	// ============================================================================

	// Settings loading state
	if (isLoadingSettings) {
		return (
			<div className="flex items-center justify-center py-12" aria-busy="true">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="ml-3 text-muted-foreground">
					Loading pricing rates…
				</span>
			</div>
		);
	}

	// Settings fetch error
	if (settingsError || !settings) {
		return (
			<div
				className="flex flex-col items-center justify-center py-12 space-y-4"
				role="alert"
			>
				<AlertCircle className="h-8 w-8 text-red-500" />
				<p className="text-red-600 text-center">
					Failed to load pricing rates. Please try refreshing the page.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Generation error message */}
			{generationError && (
				<div
					className="rounded-md border border-red-200 bg-red-50 p-3"
					role="alert"
				>
					<p className="text-sm text-red-700">{generationError}</p>
				</div>
			)}

			{/* Line item configurator */}
			<LineItemConfigurator
				settings={settings}
				caseData={caseData}
				onGenerate={handleGenerate}
				isGenerating={isGenerating}
				customerNumber={customerNumber}
				onCustomerNumberChange={(value) => {
					setCustomerNumber(value);
					if (customerNumberError && value.trim()) {
						setCustomerNumberError(null);
					}
				}}
				customerNumberError={customerNumberError}
				onRateUpdate={handleRateUpdate}
				preservedConfig={preservedConfig}
			/>
		</div>
	);
};
