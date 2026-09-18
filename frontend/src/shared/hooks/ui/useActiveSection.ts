import { useEffect, useState } from "react";

interface UseActiveSectionOptions {
	/** Element ids to observe, in document order. */
	sectionIds: readonly string[];
	/** Scrollable ancestor to observe within. Defaults to the viewport. */
	root?: HTMLElement | null;
	/**
	 * Fraction of the root's height, measured from its top, at which a section
	 * counts as active. 0.35 favours the section the reader is looking at over
	 * the one merely peeking in at the bottom.
	 */
	activationPoint?: number;
}

/**
 * Track which of several stacked sections is currently in view.
 *
 * Returns the id of the section nearest the activation line, so a section index
 * can highlight the reader's position on a long page. Falls back to the first
 * section id before any measurement has happened.
 */
export const useActiveSection = ({
	sectionIds,
	root = null,
	activationPoint = 0.35,
}: UseActiveSectionOptions): string => {
	const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? "");

	// Depend on the joined ids rather than the array so a new array of the same
	// ids does not tear down the observer on every render.
	const idKey = sectionIds.join("|");

	useEffect(() => {
		const ids = idKey ? idKey.split("|") : [];
		if (ids.length === 0) return;

		const elements = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		if (elements.length === 0) return;

		// A zero-height band at the activation line: a section is active while it
		// straddles that line.
		const bottomInset = Math.max(0, Math.round((1 - activationPoint) * 100));
		const topInset = Math.max(0, 100 - bottomInset);

		const observer = new IntersectionObserver(
			(entries) => {
				const intersecting = entries.filter((entry) => entry.isIntersecting);
				if (intersecting.length === 0) return;
				// Several sections can straddle the line on a short page; the last in
				// document order is the one the reader has scrolled to.
				const last = intersecting.reduce((furthest, entry) =>
					ids.indexOf(entry.target.id) > ids.indexOf(furthest.target.id)
						? entry
						: furthest
				);
				setActiveId(last.target.id);
			},
			{
				root,
				rootMargin: `-${topInset}% 0px -${bottomInset}% 0px`,
				threshold: 0,
			}
		);

		elements.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, [idKey, root, activationPoint]);

	return activeId;
};
