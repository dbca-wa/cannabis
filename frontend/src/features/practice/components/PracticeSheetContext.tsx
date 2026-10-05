import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { LiveCase } from "../utils/practiceProgress";
import {
	PracticeSheetContext,
	type PracticeSheetValue,
} from "./practiceSheet.context";

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
