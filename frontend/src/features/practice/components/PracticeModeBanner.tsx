import { TriangleAlert } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { usePracticeMode } from "../hooks/usePracticeMode";

/** Format an ISO expiry as a short, friendly local time. */
const formatExpiry = (iso: string | null): string => {
	if (!iso) return "";
	const date = new Date(iso);
	return date.toLocaleString("en-AU", {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	});
};

/**
 * Persistent banner shown across the app whenever the user is in practice mode,
 * so it can never be mistaken for the live system. Offers a one-click exit that
 * clears the user's practice data.
 */
export const PracticeModeBanner = () => {
	const { isOn, expiresAt, disable, isToggling } = usePracticeMode();

	if (!isOn) return null;

	const expiry = formatExpiry(expiresAt);

	return (
		<div
			role="status"
			className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
		>
			<TriangleAlert size={16} className="shrink-0" aria-hidden="true" />
			<span>
				<strong className="font-semibold">Practice mode.</strong> Nothing here
				is real — this is a safe place to rehearse.
				{expiry && (
					<span className="ml-1 opacity-80">
						Practice data clears {expiry}.
					</span>
				)}
			</span>
			<Button
				size="sm"
				variant="outline"
				className="ml-auto h-7 border-amber-400 bg-amber-50 hover:bg-amber-200 dark:bg-transparent"
				onClick={disable}
				disabled={isToggling}
			>
				{isToggling ? "Leaving…" : "Leave practice mode"}
			</Button>
		</div>
	);
};
