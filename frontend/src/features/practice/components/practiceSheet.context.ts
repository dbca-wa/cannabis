import { createContext, useContext } from "react";

import type { LiveCase } from "../utils/practiceProgress";

/**
 * Shared state for the practice brief sheet: its open/closed flag (so floating
 * prompts can open it from anywhere) and the live case-creation values the sheet
 * ticks against while the user fills in the new-case form, before any case
 * exists in the query cache.
 */
export interface PracticeSheetValue {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
	/** Live values from the in-progress new-case form, or null when not on it. */
	liveCreateData: LiveCase | null;
	setLiveCreateData: (data: LiveCase | null) => void;
}

export const PracticeSheetContext = createContext<PracticeSheetValue | null>(
	null
);

/** Access the practice sheet controls. Safe no-op outside a provider. */
export const usePracticeSheet = (): PracticeSheetValue => {
	const ctx = useContext(PracticeSheetContext);
	return (
		ctx ?? {
			isOpen: false,
			open: () => {},
			close: () => {},
			toggle: () => {},
			liveCreateData: null,
			setLiveCreateData: () => {},
		}
	);
};
