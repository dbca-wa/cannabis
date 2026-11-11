/**
 * The fake brief to work through on the case page while in practice mode.
 *
 * The brief is hardcoded (see data/practiceBriefs.ts) so the examples can be
 * controlled and extended directly. One is chosen per session and kept stable
 * for the life of that session, but the user can page through the examples with
 * the prev/next controls to see each one.
 *
 * Every caller reads the same session choice. The practice guide and the new
 * case form both use this hook, and the form only enables Create Case once the
 * brief the guide is showing has been matched, so the two must never disagree.
 */
import { useCallback, useSyncExternalStore } from "react";

import {
	PRACTICE_BRIEFS,
	getPracticeBriefIndex,
	setPracticeBriefIndex,
} from "../data/practiceBriefs";
import type { IPracticeBrief } from "../types/practice.types";

interface PracticeBriefResult {
	data: IPracticeBrief | null;
	isLoading: boolean;
	index: number;
	total: number;
	next: () => void;
	previous: () => void;
	/** Switch every caller to the example at this index. */
	select: (index: number) => void;
}

// Components showing the brief re-render when any of them pages to another
// example.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

export const usePracticeBrief = (enabled: boolean): PracticeBriefResult => {
	const index = useSyncExternalStore(subscribe, () =>
		enabled ? getPracticeBriefIndex() : 0
	);

	const go = useCallback((nextIndex: number) => {
		const n = PRACTICE_BRIEFS.length;
		const clamped = ((nextIndex % n) + n) % n;
		setPracticeBriefIndex(clamped);
		for (const listener of listeners) listener();
	}, []);

	return {
		data: enabled ? PRACTICE_BRIEFS[index] : null,
		isLoading: false,
		index,
		total: PRACTICE_BRIEFS.length,
		next: () => go(index + 1),
		previous: () => go(index - 1),
		select: go,
	};
};
