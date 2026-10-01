/**
 * The fake brief to work through on the case page while in practice mode.
 *
 * The brief is generated server-side. It is fetched once and kept for the life
 * of the session (the endpoint regenerates on each call, so it is not refetched)
 * giving the user a stable set of details to enter.
 */
import { useQuery } from "@tanstack/react-query";

import { getPracticeBrief } from "../services/practice.service";

export const usePracticeBrief = (enabled: boolean) =>
	useQuery({
		queryKey: ["practice", "brief"],
		queryFn: getPracticeBrief,
		enabled,
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnWindowFocus: false,
	});
