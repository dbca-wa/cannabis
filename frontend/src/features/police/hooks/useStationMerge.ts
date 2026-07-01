import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	policeStationsService,
	type StationMergeRequest,
} from "../services/policeStations.service";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";

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
				`Merge complete. ${response.officers_reassigned} officer(s) and ${response.cases_reassigned} case(s) reassigned.`
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Merge failed. Please try again.");
		},
	});
}
