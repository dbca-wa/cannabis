/**
 * The fake brief to work through on the case page while in practice mode.
 *
 * The brief is hardcoded (see data/practiceBriefs.ts) so the examples can be
 * controlled and extended directly. One is chosen per session and kept stable
 * for the life of that session.
 */
import { useMemo } from "react";

import { getSessionPracticeBrief } from "../data/practiceBriefs";
import type { IPracticeBrief } from "../types/practice.types";

export const usePracticeBrief = (
	enabled: boolean
): { data: IPracticeBrief | null; isLoading: boolean } => {
	const data = useMemo(
		() => (enabled ? getSessionPracticeBrief() : null),
		[enabled]
	);
	return { data, isLoading: false };
};
