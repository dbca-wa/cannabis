import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/utils/error.utils";
import {
	generateCertificates,
	regenerateCertificate,
	getCertificatePdfUrl,
} from "../services/documents.service";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import { API_CONFIG } from "@/shared/services/api";

/**
 * Hook for certificate generation mutations.
 *
 * Provides generate/regenerate mutations with automatic query invalidation so
 * the case detail refreshes after certificate creation. Certificates are the
 * only generated document — invoices and signing have been removed.
 */
export const useDocumentGeneration = (submissionId: number) => {
	const queryClient = useQueryClient();

	const generateCertificatesMutation = useMutation({
		mutationFn: (groups?: number[][]) =>
			generateCertificates(submissionId, groups),
		onSuccess: async (certificates) => {
			await invalidateRelatedQueries(queryClient, "certificates");
			toast.success(
				`Generated ${certificates.length} certificate${
					certificates.length === 1 ? "" : "s"
				}`
			);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to generate certificates: ${getErrorMessage(error)}`);
		},
	});

	const regenerateCertificateMutation = useMutation({
		mutationFn: (certificateId: number) =>
			regenerateCertificate(submissionId, certificateId),
		onSuccess: async (certificate) => {
			await invalidateRelatedQueries(queryClient, "certificates");
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

	const viewCertificatePdf = (certificateId: number) => {
		const relativePath = getCertificatePdfUrl(submissionId, certificateId);
		const fullUrl = `${API_CONFIG.BASE_URL}${relativePath}`;
		window.open(fullUrl, "_blank");
	};

	return {
		generateCertificates: generateCertificatesMutation.mutate,
		regenerateCertificate: regenerateCertificateMutation.mutate,
		isGeneratingCertificates: generateCertificatesMutation.isPending,
		isRegeneratingCertificate: regenerateCertificateMutation.isPending,
		viewCertificatePdf,
	};
};
