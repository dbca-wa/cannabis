import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	policeStationsService,
	type StationMergeRequest,
} from "../services/policeStations.service";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { countOf } from "@/shared/utils/number.utils";

/**
 * Hook to merge secondary stations into a primary station.
 * Transfers all officers and cases to the primary and deletes the secondaries.
 */
export function useStationMerge() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: StationMergeRequest) =>
			policeStationsService.mergeStations(data),
		onSuccess: async (response) => {
			await invalidateRelatedQueries(queryClient, "policeStations");

			toast.success(
				`Merge complete. ${countOf(response.officers_reassigned, "officer")} and ${countOf(response.cases_reassigned, "case")} moved.`
			);
		},
		onError: (error: unknown) => {
			toast.error(getErrorMessage(error) || "Merge failed. Please try again.");
		},
	});
}
