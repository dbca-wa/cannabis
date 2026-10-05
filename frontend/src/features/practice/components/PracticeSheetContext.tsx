import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Shared open/closed state for the always-accessible practice brief sheet, so
 * the floating action prompts can open it from anywhere in the app.
 */
interface PracticeSheetValue {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
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
	const value = useMemo<PracticeSheetValue>(
		() => ({
			isOpen,
			open: () => setIsOpen(true),
			close: () => setIsOpen(false),
			toggle: () => setIsOpen((v) => !v),
		}),
		[isOpen]
	);
	return (
		<PracticeSheetContext.Provider value={value}>
			{children}
		</PracticeSheetContext.Provider>
	);
};

/** Access the practice sheet open/close controls. Safe no-op outside a provider. */
export const usePracticeSheet = (): PracticeSheetValue => {
	const ctx = useContext(PracticeSheetContext);
	return (
		ctx ?? {
			isOpen: false,
			open: () => {},
			close: () => {},
			toggle: () => {},
		}
	);
};
