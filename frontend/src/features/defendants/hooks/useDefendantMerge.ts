import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	mergeDefendants,
	type DefendantMergeRequest,
} from "../services/defendants.service";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { countOf } from "@/shared/utils/number.utils";

/**
 * Hook to merge secondary defendants into a primary defendant.
 * Transfers all case associations to the primary and deletes the secondaries.
 */
export const useDefendantMerge = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: DefendantMergeRequest) => mergeDefendants(data),
		onSuccess: async (response) => {
			await invalidateRelatedQueries(queryClient, "defendants");

			toast.success(
				`Merge complete. ${countOf(response.cases_reassigned, "case")} moved.`
			);
		},
		onError: (error: unknown) => {
			toast.error(getErrorMessage(error) || "Merge failed. Please try again.");
		},
	});
};
