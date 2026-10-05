import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { LiveCase } from "../utils/practiceProgress";

/**
 * Shared state for the practice brief sheet: its open/closed flag (so floating
 * prompts can open it from anywhere) and the live case-creation values the sheet
 * ticks against while the user fills in the new-case form, before any case
 * exists in the query cache.
 */
interface PracticeSheetValue {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
	/** Live values from the in-progress new-case form, or null when not on it. */
	liveCreateData: LiveCase | null;
	setLiveCreateData: (data: LiveCase | null) => void;
}

const PracticeSheetContext = createContext<PracticeSheetValue | null>(null);

export const PracticeSheetProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	// Open by default so a user who has just entered practice mode sees their
	// brief without having to find a button first.
	const [isOpen, setIsOpen] = useState(true);
	const [liveCreateData, setLiveCreateData] = useState<LiveCase | null>(null);

	const value = useMemo<PracticeSheetValue>(
		() => ({
			isOpen,
			open: () => setIsOpen(true),
			close: () => setIsOpen(false),
			toggle: () => setIsOpen((v) => !v),
			liveCreateData,
			setLiveCreateData,
		}),
		[isOpen, liveCreateData]
	);
	return (
		<PracticeSheetContext.Provider value={value}>
			{children}
		</PracticeSheetContext.Provider>
	);
};

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
