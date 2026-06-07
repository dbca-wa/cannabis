/**
 * TanStack Query mutation hooks for signature management and certificate signing.
 *
 * Uses predicate-based invalidation to catch all signature-related queries,
 * and awaits invalidation so the UI reflects changes immediately.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signaturesService } from "../services/signatures.service";

/** Predicate that matches any query whose key starts with "signature". */
const isSignatureQuery = (query: { queryKey: readonly unknown[] }) => {
	const key = query.queryKey;
	return Array.isArray(key) && key[0] === "signature";
};

/** Uploads or replaces the current user's signature image. */
export const useUploadSignature = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: FormData) => {
			const result = await signaturesService.uploadSignature(data);
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ predicate: isSignatureQuery });
			toast.success("Signature uploaded successfully");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to upload signature");
		},
	});
};

/** Deletes the current user's signature. */
export const useDeleteSignature = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			const result = await signaturesService.deleteSignature();
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ predicate: isSignatureQuery });
			toast.success("Signature deleted successfully");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete signature");
		},
	});
};

/** Signs a certificate with the current user's digital signature. */
export const useSignCertificate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			submissionId,
			certificateId,
		}: {
			submissionId: number;
			certificateId: number;
		}) => {
			const result = await signaturesService.signCertificate(
				submissionId,
				certificateId
			);
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ predicate: isSignatureQuery });
			await queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === "cases";
				},
			});
			await queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === "certificates";
				},
			});
			toast.success("Certificate signed successfully");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to sign certificate");
		},
	});
};

/** Unlocks a certificate to allow unsigned PDF regeneration. */
export const useUnlockCertificate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			submissionId,
			certificateId,
		}: {
			submissionId: number;
			certificateId: number;
		}) => {
			const result = await signaturesService.unlockCertificate(
				submissionId,
				certificateId
			);
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ predicate: isSignatureQuery });
			await queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === "cases";
				},
			});
			await queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === "certificates";
				},
			});
			toast.success("Certificate unlocked successfully");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to unlock certificate");
		},
	});
};
