/**
 * Practice mode hook.
 *
 * Practice mode is server-owned per-user state surfaced on the authenticated
 * user (`practice_mode`, `practice_mode_expires_at`). Toggling it refetches the
 * user and, because turning it off purges the user's practice data and flips
 * what every list returns, performs a full reload so the app comes back cleanly
 * in the other mode.
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/hooks/useAuth";
import {
	disablePracticeMode,
	enablePracticeMode,
	resetPracticeData,
	restartPracticeCase,
} from "../services/practice.service";

export const usePracticeMode = () => {
	const { user, refetchUser } = useAuth();

	const isOn = !!user?.practice_mode;
	const startedAt = user?.practice_mode_started_at ?? null;

	const enable = useMutation({
		mutationFn: enablePracticeMode,
		onSuccess: () => {
			// Reload so every list re-fetches as the user's practice data.
			window.location.assign("/cases");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Could not start practice mode");
		},
	});

	const disable = useMutation({
		mutationFn: disablePracticeMode,
		onSuccess: () => {
			// Practice data is kept server-side; reload so the real lists return
			// and nothing practice-scoped lingers in the client cache.
			window.location.assign("/");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Could not leave practice mode");
		},
	});

	const reset = useMutation({
		mutationFn: resetPracticeData,
		onSuccess: () => {
			// A clean slate: reload so every list re-fetches the now-empty
			// practice data and the guide starts from the first step again.
			window.location.assign("/cases");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Could not reset practice data");
		},
	});

	const restartCase = useMutation({
		mutationFn: (caseId: number) => restartPracticeCase(caseId),
		onSuccess: () => {
			// The case and its data are gone; return to the cases list to start
			// that case over from the beginning.
			window.location.assign("/cases");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Could not restart the practice case");
		},
	});

	return {
		isOn,
		startedAt,
		enable: () => enable.mutate(),
		disable: () => disable.mutate(),
		reset: () => reset.mutate(),
		restartCase: (caseId: number) => restartCase.mutate(caseId),
		isToggling:
			enable.isPending ||
			disable.isPending ||
			reset.isPending ||
			restartCase.isPending,
		refetchUser,
	};
};
