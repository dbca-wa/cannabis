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
} from "../services/practice.service";

export const usePracticeMode = () => {
	const { user, refetchUser } = useAuth();

	const isOn = !!user?.practice_mode;
	const expiresAt = user?.practice_mode_expires_at ?? null;

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
			// The server has purged the user's practice data; reload so the real
			// lists return and nothing practice-related lingers in the cache.
			window.location.assign("/");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Could not leave practice mode");
		},
	});

	return {
		isOn,
		expiresAt,
		enable: () => enable.mutate(),
		disable: () => disable.mutate(),
		isToggling: enable.isPending || disable.isPending,
		refetchUser,
	};
};
