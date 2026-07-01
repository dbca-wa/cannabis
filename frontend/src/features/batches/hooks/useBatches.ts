import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/utils/error.utils";
import {
	getBatches,
	getBatch,
	createBatch,
	recordInvoiceRaised,
	unsetInvoiceRaised,
	deleteBatch,
} from "../services/batches.service";
import type {
	BatchOrdering,
	CreateBatchRequest,
	RecordInvoiceRaisedRequest,
} from "../types/batches.types";

export const batchesQueryKeys = {
	all: ["batches"] as const,
	lists: () => [...batchesQueryKeys.all, "list"] as const,
	list: (ordering: BatchOrdering) =>
		[...batchesQueryKeys.lists(), ordering] as const,
	detail: (id: number) => [...batchesQueryKeys.all, "detail", id] as const,
};

const invalidateBatches = (queryClient: ReturnType<typeof useQueryClient>) =>
	queryClient.invalidateQueries({
		predicate: (query) =>
			Array.isArray(query.queryKey) &&
			(query.queryKey[0] === "batches" ||
				query.queryKey[0] === "cases" ||
				query.queryKey[0] === "dashboard"),
	});

/** List batches with optional sorting. */
export const useBatches = (ordering: BatchOrdering = "-created_at") =>
	useQuery({
		queryKey: batchesQueryKeys.list(ordering),
		queryFn: () => getBatches(ordering),
		staleTime: 60_000,
	});

/** Single batch detail. */
export const useBatch = (id: number | null) =>
	useQuery({
		queryKey: batchesQueryKeys.detail(id ?? 0),
		queryFn: () => getBatch(id!),
		enabled: id != null,
		staleTime: 60_000,
	});

/** Create a batch from selected cases. */
export const useCreateBatch = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateBatchRequest) => createBatch(payload),
		onSuccess: async (batch) => {
			await invalidateBatches(queryClient);
			toast.success(`Created ${batch.batch_number}`);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to create batch: ${getErrorMessage(error)}`);
		},
	});
};

/** Record an invoice-raised number on a batch. */
export const useRecordInvoiceRaised = (id: number) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: RecordInvoiceRaisedRequest) =>
			recordInvoiceRaised(id, payload),
		onSuccess: async () => {
			await invalidateBatches(queryClient);
			toast.success("Invoice number recorded; cases marked complete");
		},
		onError: (error: unknown) => {
			toast.error(`Failed to record invoice number: ${getErrorMessage(error)}`);
		},
	});
};

/** Clear the invoice-raised number on a batch (returns cases to In Batch). */
export const useUnsetInvoiceRaised = (id: number) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => unsetInvoiceRaised(id),
		onSuccess: async () => {
			await invalidateBatches(queryClient);
			toast.success("Invoice number cleared; cases returned to in-batch");
		},
		onError: (error: unknown) => {
			toast.error(`Failed to clear invoice number: ${getErrorMessage(error)}`);
		},
	});
};

/** Delete a batch. */
export const useDeleteBatch = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => deleteBatch(id),
		onSuccess: async () => {
			await invalidateBatches(queryClient);
			toast.success("Batch deleted; cases returned to batching");
		},
		onError: (error: unknown) => {
			toast.error(`Failed to delete batch: ${getErrorMessage(error)}`);
		},
	});
};
