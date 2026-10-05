/**
 * The fake brief to work through on the case page while in practice mode.
 *
 * The brief is hardcoded (see data/practiceBriefs.ts) so the examples can be
 * controlled and extended directly. One is chosen per session and kept stable
 * for the life of that session, but the user can page through the examples with
 * the prev/next controls to see each one.
 */
import { useCallback, useState } from "react";

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
}

export const usePracticeBrief = (enabled: boolean): PracticeBriefResult => {
	const [index, setIndex] = useState(() =>
		enabled ? getPracticeBriefIndex() : 0
	);

	const go = useCallback((nextIndex: number) => {
		const n = PRACTICE_BRIEFS.length;
		const clamped = ((nextIndex % n) + n) % n;
		setPracticeBriefIndex(clamped);
		setIndex(clamped);
	}, []);

	return {
		data: enabled ? PRACTICE_BRIEFS[index] : null,
		isLoading: false,
		index,
		total: PRACTICE_BRIEFS.length,
		next: () => go(index + 1),
		previous: () => go(index - 1),
	};
};
