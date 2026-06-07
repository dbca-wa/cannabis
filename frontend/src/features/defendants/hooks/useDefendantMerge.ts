import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	mergeDefendants,
	type DefendantMergeRequest,
} from "../services/defendants.service";
import { defendantsQueryKeys } from "./useDefendants";

/**
 * Hook to merge secondary defendants into a primary defendant.
 * Transfers all case associations to the primary and deletes the secondaries.
 */
export const useDefendantMerge = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: DefendantMergeRequest) => mergeDefendants(data),
		onSuccess: async (response) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: defendantsQueryKeys.all,
				}),
				queryClient.invalidateQueries({
					queryKey: ["cases"],
				}),
			]);

			toast.success(
				`Merge complete. ${response.cases_reassigned} case(s) reassigned.`
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Merge failed. Please try again.");
		},
	});
};
