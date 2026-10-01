import { useState } from "react";
import { Lightbulb, X } from "lucide-react";

import { usePracticeMode } from "../hooks/usePracticeMode";

interface PracticeCoachmarkProps {
	/** Stable id so a dismissed hint stays dismissed for the session. */
	id: string;
	title: string;
	children: React.ReactNode;
}

/**
 * A dismissible guidance note shown within a section while in practice mode. It
 * teaches the user what to do at that point in the real workflow, then gets out
 * of the way once dismissed. Renders nothing outside practice mode.
 */
export const PracticeCoachmark = ({
	id,
	title,
	children,
}: PracticeCoachmarkProps) => {
	const { isOn } = usePracticeMode();
	const storageKey = `practice-coachmark-dismissed:${id}`;
	const [dismissed, setDismissed] = useState(
		() => sessionStorage.getItem(storageKey) === "1"
	);

	if (!isOn || dismissed) return null;

	const handleDismiss = () => {
		sessionStorage.setItem(storageKey, "1");
		setDismissed(true);
	};

	return (
		<div className="mb-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
			<Lightbulb size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
			<div className="flex-1">
				<p className="font-semibold">{title}</p>
				<div className="mt-1 text-amber-900/90 dark:text-amber-100/90">
					{children}
				</div>
			</div>
			<button
				type="button"
				onClick={handleDismiss}
				aria-label="Dismiss hint"
				className="shrink-0 rounded p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/40"
			>
				<X size={16} aria-hidden="true" />
			</button>
		</div>
	);
};
