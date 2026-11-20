import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	deleteLegacyImportBundle,
	getLegacyImportBundle,
	getLegacyImportRuns,
	startLegacyImportRun,
	uploadLegacyImportBundle,
} from "../services/legacyImport.service";
import type { LegacyImportAction } from "../types/legacyImport.types";

const BUNDLE_KEY = ["legacy-import", "bundle"] as const;
const RUNS_KEY = ["legacy-import", "runs"] as const;

/**
 * The legacy import bundle and recent runs. Runs are polled every few seconds
 * while one is in progress, so its log and result appear without a reload.
 */
export const useLegacyImport = (enabled: boolean) => {
	const queryClient = useQueryClient();

	const bundleQuery = useQuery({
		queryKey: BUNDLE_KEY,
		queryFn: getLegacyImportBundle,
		enabled,
		staleTime: 30_000,
	});

	const runsQuery = useQuery({
		queryKey: RUNS_KEY,
		queryFn: getLegacyImportRuns,
		enabled,
		staleTime: 5_000,
		refetchInterval: (query) =>
			query.state.data?.some((run) => run.status === "running") ? 3_000 : false,
	});

	const refreshAll = async () => {
		await queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] === "legacy-import",
		});
	};

	const upload = useMutation({
		mutationFn: uploadLegacyImportBundle,
		onSuccess: async (bundle) => {
			await refreshAll();
			toast.success(
				`Bundle uploaded: ${bundle.summary.source_rows ?? 0} source rows checked`
			);
		},
		onError: (error: Error) => toast.error(error.message || "Upload failed"),
	});

	const removeBundle = useMutation({
		mutationFn: deleteLegacyImportBundle,
		onSuccess: async () => {
			await refreshAll();
			toast.success("Bundle deleted");
		},
		onError: (error: Error) => toast.error(error.message || "Could not delete"),
	});

	const start = useMutation({
		mutationFn: (action: LegacyImportAction) => startLegacyImportRun(action),
		onSuccess: async (run) => {
			await refreshAll();
			toast.success(`${run.action_display} started`);
		},
		onError: (error: Error) => toast.error(error.message || "Could not start"),
	});

	const runs = runsQuery.data ?? [];
	return {
		bundle: bundleQuery.data ?? null,
		runs,
		isLoading: bundleQuery.isLoading || runsQuery.isLoading,
		isRunning: runs.some((run) => run.status === "running"),
		upload,
		removeBundle,
		start,
	};
};
