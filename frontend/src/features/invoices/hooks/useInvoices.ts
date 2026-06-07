import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getInvoices,
	getInvoiceById,
	searchInvoices,
	createInvoice,
	updateInvoice,
	deleteInvoice,
	downloadInvoice,
} from "../services";
import type {
	Invoice,
	InvoiceCreateRequest,
	PaginatedInvoicesResponse,
	InvoiceSearchParams,
} from "@/shared/types/backend-api.types";

import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";

// Query keys for invoices
export const invoiceQueryKeys = {
	all: ["invoices"] as const,
	lists: () => [...invoiceQueryKeys.all, "list"] as const,
	list: (params: Record<string, unknown>) =>
		[...invoiceQueryKeys.lists(), params] as const,
	details: () => [...invoiceQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...invoiceQueryKeys.details(), id] as const,
	searches: () => [...invoiceQueryKeys.all, "search"] as const,
	search: (params: InvoiceSearchParams) =>
		[...invoiceQueryKeys.searches(), params] as const,
};

/** Hook to fetch paginated invoices */
export const useInvoices = (
	params: {
		page?: number;
		search?: string;
		case?: number;
		ordering?: string;
		limit?: number;
	} = {}
) => {
	return useQuery({
		queryKey: invoiceQueryKeys.list(params),
		queryFn: (): Promise<PaginatedInvoicesResponse> => getInvoices(params),
		staleTime: 5 * 60 * 1000,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

/** Hook to fetch a single invoice by ID */
export const useInvoiceById = (id: number | null) => {
	return useQuery({
		queryKey: invoiceQueryKeys.detail(id!),
		queryFn: (): Promise<Invoice> => {
			if (!id) throw new Error("Invoice ID is required");
			return getInvoiceById(id);
		},
		enabled: !!id,
		staleTime: 5 * 60 * 1000,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

/** Hook to search invoices */
export const useInvoiceSearch = (params: InvoiceSearchParams) => {
	return useQuery({
		queryKey: invoiceQueryKeys.search(params),
		queryFn: (): Promise<PaginatedInvoicesResponse> => searchInvoices(params),
		enabled: !!params.search || !!params.case,
		staleTime: 2 * 60 * 1000,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

/** Hook to create a new invoice */
export const useCreateInvoice = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: InvoiceCreateRequest) => createInvoice(data),
		onSuccess: async (newInvoice) => {
			queryClient.setQueryData(
				invoiceQueryKeys.detail(newInvoice.id),
				newInvoice
			);
			queryClient.invalidateQueries({
				queryKey: invoiceQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: invoiceQueryKeys.searches(),
			});
			toast.success("Invoice created successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to create invoice", { error });
			toast.error("Failed to create invoice. Please try again.");
		},
	});
};

/** Hook to update an existing invoice */
export const useUpdateInvoice = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: number;
			data: Partial<InvoiceCreateRequest>;
		}) => updateInvoice(id, data),
		onSuccess: async (updatedInvoice) => {
			queryClient.setQueryData(
				invoiceQueryKeys.detail(updatedInvoice.id),
				updatedInvoice
			);
			queryClient.invalidateQueries({
				queryKey: invoiceQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: invoiceQueryKeys.searches(),
			});
			toast.success("Invoice updated successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to update invoice", { error });
			toast.error("Failed to update invoice. Please try again.");
		},
	});
};

/** Hook to delete an invoice */
export const useDeleteInvoice = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => deleteInvoice(id),
		onSuccess: async (_, deletedId) => {
			queryClient.removeQueries({
				queryKey: invoiceQueryKeys.detail(deletedId),
			});
			queryClient.invalidateQueries({
				queryKey: invoiceQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: invoiceQueryKeys.searches(),
			});
			toast.success("Invoice deleted successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to delete invoice", { error });
			toast.error("Failed to delete invoice. Please try again.");
		},
	});
};

/** Hook to download an invoice PDF */
export const useDownloadInvoice = () => {
	return useMutation({
		mutationFn: async ({ id, filename }: { id: number; filename: string }) => {
			const blob = await downloadInvoice(id);
			return { blob, filename };
		},
		onSuccess: ({ blob, filename }) => {
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
			toast.success("Invoice downloaded successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to download invoice", { error });
			toast.error("Failed to download invoice. Please try again.");
		},
	});
};
