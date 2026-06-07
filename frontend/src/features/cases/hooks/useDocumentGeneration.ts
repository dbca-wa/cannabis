import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/utils/error.utils";
import {
	generateCertificate,
	regenerateCertificate,
	generateInvoice,
	regenerateInvoice,
	getCertificatePdfUrl,
	getInvoicePdfUrl,
} from "../services/documents.service";
import { casesQueryKeys } from "./useCases";
import { API_CONFIG } from "@/shared/services/api";

/**
 * Hook for document generation mutations (certificates and invoices).
 *
 * Provides generate/regenerate mutations with automatic query invalidation
 * so the case detail refreshes after document creation.
 */
export const useDocumentGeneration = (submissionId: number) => {
	const queryClient = useQueryClient();

	const invalidateCase = () => {
		queryClient.invalidateQueries({
			queryKey: casesQueryKeys.detail(submissionId),
		});
		queryClient.invalidateQueries({
			queryKey: casesQueryKeys.lists(),
		});
	};

	// --- Certificate mutations ---

	const generateCertificateMutation = useMutation({
		mutationFn: () => generateCertificate(submissionId),
		onSuccess: (certificate) => {
			invalidateCase();
			toast.success(
				`Certificate ${certificate.certificate_number} generated successfully`
			);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to generate certificate: ${getErrorMessage(error)}`);
		},
	});

	const regenerateCertificateMutation = useMutation({
		mutationFn: (certificateId: number) =>
			regenerateCertificate(submissionId, certificateId),
		onSuccess: (certificate) => {
			invalidateCase();
			toast.success(
				`Certificate ${certificate.certificate_number} regenerated successfully`
			);
		},
		onError: (error: unknown) => {
			toast.error(
				`Failed to regenerate certificate: ${getErrorMessage(error)}`
			);
		},
	});

	// --- Invoice mutations ---

	const generateInvoiceMutation = useMutation({
		mutationFn: (customerNumber: string) =>
			generateInvoice(submissionId, customerNumber),
		onSuccess: (invoice) => {
			invalidateCase();
			toast.success(`Invoice ${invoice.invoice_number} generated successfully`);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to generate invoice: ${getErrorMessage(error)}`);
		},
	});

	const regenerateInvoiceMutation = useMutation({
		mutationFn: (invoiceId: number) =>
			regenerateInvoice(submissionId, invoiceId),
		onSuccess: (invoice) => {
			invalidateCase();
			toast.success(
				`Invoice ${invoice.invoice_number} regenerated successfully`
			);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to regenerate invoice: ${getErrorMessage(error)}`);
		},
	});

	// --- PDF viewing helpers ---

	const viewCertificatePdf = (certificateId: number) => {
		const relativePath = getCertificatePdfUrl(submissionId, certificateId);
		const fullUrl = `${API_CONFIG.BASE_URL}${relativePath}`;
		window.open(fullUrl, "_blank");
	};

	const viewInvoicePdf = (invoiceId: number) => {
		const relativePath = getInvoicePdfUrl(submissionId, invoiceId);
		const fullUrl = `${API_CONFIG.BASE_URL}${relativePath}`;
		window.open(fullUrl, "_blank");
	};

	return {
		generateCertificate: generateCertificateMutation.mutate,
		regenerateCertificate: regenerateCertificateMutation.mutate,
		isGeneratingCertificate: generateCertificateMutation.isPending,
		isRegeneratingCertificate: regenerateCertificateMutation.isPending,
		viewCertificatePdf,
		generateInvoice: generateInvoiceMutation.mutate,
		regenerateInvoice: regenerateInvoiceMutation.mutate,
		isGeneratingInvoice: generateInvoiceMutation.isPending,
		isRegeneratingInvoice: regenerateInvoiceMutation.isPending,
		viewInvoicePdf,
	};
};
