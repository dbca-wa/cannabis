import { TriangleAlert } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { usePracticeMode } from "../hooks/usePracticeMode";

/**
 * Persistent banner shown across the app whenever the user is in practice mode,
 * so it can never be mistaken for the live system. Leaving keeps the user's
 * practice work for next time; a separate reset clears it on demand.
 */
export const PracticeModeBanner = () => {
	const { isOn, disable, reset, isToggling } = usePracticeMode();

	if (!isOn) return null;

	const handleReset = () => {
		if (
			window.confirm(
				"Clear all your practice data and start fresh? This cannot be undone."
			)
		) {
			reset();
		}
	};

	return (
		<div
			role="status"
			className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
		>
			<TriangleAlert size={16} className="shrink-0" aria-hidden="true" />
			<span>
				<strong className="font-semibold">Practice mode.</strong> Nothing here
				is real — this is a safe place to rehearse. Your practice work is kept
				for next time.
			</span>
			<div className="ml-auto flex items-center gap-2">
				<Button
					size="sm"
					variant="outline"
					className="h-7 border-amber-400 bg-amber-50 hover:bg-amber-200 dark:bg-transparent"
					onClick={handleReset}
					disabled={isToggling}
				>
					Reset practice data
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="h-7 border-amber-400 bg-amber-50 hover:bg-amber-200 dark:bg-transparent"
					onClick={disable}
					disabled={isToggling}
				>
					{isToggling ? "Working…" : "Leave practice mode"}
				</Button>
			</div>
		</div>
	);
};
