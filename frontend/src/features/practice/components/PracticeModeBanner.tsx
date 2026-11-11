import { TriangleAlert } from "lucide-react";
import { useLocation } from "react-router";

import { Button } from "@/shared/components/ui/button";
import { usePracticeMode } from "../hooks/usePracticeMode";
import { isSharedDataPage } from "../utils/practicePages";

// The text colour is set for both themes: the outline variant's own colour is
// near-black, which disappeared against the dark banner.
const BANNER_BUTTON =
	"h-7 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-50";

/**
 * Persistent banner shown across the app whenever the user is in practice mode,
 * so it can never be mistaken for the live system. Leaving keeps the user's
 * practice work for next time; a separate reset clears it on demand.
 *
 * Settings, Staff, Invitations and Testing have no practice copy, so on those
 * pages the banner says the data is real and cannot be changed until the user
 * leaves practice mode.
 */
export const PracticeModeBanner = () => {
	const { isOn, disable, reset, isToggling } = usePracticeMode();
	const { pathname } = useLocation();

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
			// Below lg the menu button floats over the top-left corner, so the
			// text starts to its right.
			className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-100 py-2 pl-20 pr-4 text-sm text-amber-900 lg:pl-4 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
		>
			<TriangleAlert size={16} className="shrink-0" aria-hidden="true" />
			{isSharedDataPage(pathname) ? (
				<span>
					<strong className="font-semibold">Practice mode.</strong> This page
					shows real data that everyone uses, so nothing here can be changed
					until you leave practice mode.
				</span>
			) : (
				<span>
					<strong className="font-semibold">Practice mode.</strong> Nothing here
					is real — this is a safe place to rehearse. Your practice work is kept
					for next time.
				</span>
			)}
			<div className="ml-auto flex flex-wrap items-center gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className={BANNER_BUTTON}
					onClick={handleReset}
					disabled={isToggling}
				>
					Reset practice data
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className={BANNER_BUTTON}
					onClick={disable}
					disabled={isToggling}
				>
					{isToggling ? "Working…" : "Leave practice mode"}
				</Button>
			</div>
		</div>
	);
};
