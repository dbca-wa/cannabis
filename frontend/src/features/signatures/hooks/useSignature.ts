/**
 * TanStack Query hook for fetching the current user's signature.
 */

import { useQuery } from "@tanstack/react-query";
import { signaturesService } from "../services/signatures.service";

/** Query keys for signature-related queries. */
export const signatureQueryKeys = {
	all: ["signature"] as const,
	me: () => [...signatureQueryKeys.all, "me"] as const,
};

/** Fetches the current user's signature metadata. Returns null if none exists. */
export const useSignature = () => {
	return useQuery({
		queryKey: signatureQueryKeys.me(),
		queryFn: async () => {
			const result = await signaturesService.getMySignature();
			if (!result.success) {
				// 404 "No signature on file" is a valid empty state, not an error
				if (result.error?.includes("No signature on file")) {
					return null;
				}
				throw new Error(result.error);
			}
			return result.data;
		},
		staleTime: 5 * 60_000,
		retry: (failureCount, error) => {
			// Don't retry if the error is just "no signature"
			if (error.message?.includes("No signature on file")) return false;
			return failureCount < 2;
		},
	});
};
