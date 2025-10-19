import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CertificatesService } from "../services";
import type {
	Certificate,
	CertificateCreateRequest,
	PaginatedCertificatesResponse,
	CertificateSearchParams,
} from "@/shared/types/backend-api.types";

import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";

// Query keys for certificates
export const certificateQueryKeys = {
	all: ["certificates"] as const,
	lists: () => [...certificateQueryKeys.all, "list"] as const,
	list: (params: Record<string, unknown>) =>
		[...certificateQueryKeys.lists(), params] as const,
	details: () => [...certificateQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...certificateQueryKeys.details(), id] as const,
	searches: () => [...certificateQueryKeys.all, "search"] as const,
	search: (params: CertificateSearchParams) =>
		[...certificateQueryKeys.searches(), params] as const,
};

// Hook to fetch paginated certificates
export const useCertificates = (
	params: {
		page?: number;
		search?: string;
		submission?: number;
		ordering?: string;
		limit?: number;
	} = {}
) => {
	return useQuery({
		queryKey: certificateQueryKeys.list(params),
		queryFn: async (): Promise<PaginatedCertificatesResponse> => {
			return await CertificatesService.getCertificates(params);
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

// Hook to fetch a single certificate by ID
export const useCertificateById = (id: number | null) => {
	return useQuery({
		queryKey: certificateQueryKeys.detail(id!),
		queryFn: async (): Promise<Certificate> => {
			if (!id) throw new Error("Certificate ID is required");
			return await CertificatesService.getCertificateById(id);
		},
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

// Hook to search certificates
export const useCertificateSearch = (params: CertificateSearchParams) => {
	return useQuery({
		queryKey: certificateQueryKeys.search(params),
		queryFn: async (): Promise<PaginatedCertificatesResponse> => {
			return await CertificatesService.searchCertificates(params);
		},
		enabled: !!params.search || !!params.submission,
		staleTime: 2 * 60 * 1000, // 2 minutes
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

// Hook to create a new certificate
export const useCreateCertificate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CertificateCreateRequest) =>
			CertificatesService.createCertificate(data),
		onSuccess: async (newCertificate) => {
			// Update specific certificate cache
			queryClient.setQueryData(
				certificateQueryKeys.detail(newCertificate.id),
				newCertificate
			);

			// Invalidate list queries
			queryClient.invalidateQueries({
				queryKey: certificateQueryKeys.lists(),
			});

			// Invalidate search queries
			queryClient.invalidateQueries({
				queryKey: certificateQueryKeys.searches(),
			});

			toast.success("Certificate created successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to create certificate", { error });
			toast.error("Failed to create certificate. Please try again.");
		},
	});
};

// Hook to update a certificate
export const useUpdateCertificate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: number;
			data: Partial<CertificateCreateRequest>;
		}) => CertificatesService.updateCertificate(id, data),
		onSuccess: async (updatedCertificate) => {
			// Update specific certificate cache
			queryClient.setQueryData(
				certificateQueryKeys.detail(updatedCertificate.id),
				updatedCertificate
			);

			// Invalidate list queries
			queryClient.invalidateQueries({
				queryKey: certificateQueryKeys.lists(),
			});

			// Invalidate search queries
			queryClient.invalidateQueries({
				queryKey: certificateQueryKeys.searches(),
			});

			toast.success("Certificate updated successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to update certificate", { error });
			toast.error("Failed to update certificate. Please try again.");
		},
	});
};

// Hook to delete a certificate
export const useDeleteCertificate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => CertificatesService.deleteCertificate(id),
		onSuccess: async (_, deletedId) => {
			// Remove from cache
			queryClient.removeQueries({
				queryKey: certificateQueryKeys.detail(deletedId),
			});

			// Invalidate list queries
			queryClient.invalidateQueries({
				queryKey: certificateQueryKeys.lists(),
			});

			// Invalidate search queries
			queryClient.invalidateQueries({
				queryKey: certificateQueryKeys.searches(),
			});

			toast.success("Certificate deleted successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to delete certificate", { error });
			toast.error("Failed to delete certificate. Please try again.");
		},
	});
};

// Hook to download a certificate PDF
export const useDownloadCertificate = () => {
	return useMutation({
		mutationFn: async ({
			id,
			filename,
		}: {
			id: number;
			filename: string;
		}) => {
			const blob = await CertificatesService.downloadCertificate(id);
			return { blob, filename };
		},
		onSuccess: ({ blob, filename }) => {
			// Create download link
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			toast.success("Certificate downloaded successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to download certificate", { error });
			toast.error("Failed to download certificate. Please try again.");
		},
	});
};
