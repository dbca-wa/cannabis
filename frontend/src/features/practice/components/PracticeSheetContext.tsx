import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { LiveCase } from "../utils/practiceProgress";
import {
	PracticeSheetContext,
	type PracticeSheetValue,
} from "./practiceSheet.context";

const GUIDE_ENABLED_KEY = "cannabis.guideEnabled";

const readGuideEnabled = (): boolean => {
	try {
		return localStorage.getItem(GUIDE_ENABLED_KEY) === "true";
	} catch {
		return false;
	}
};

export const PracticeSheetProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	// Open by default so a user who has just entered practice mode sees their
	// brief without having to find a button first.
	const [isOpen, setIsOpen] = useState(true);
	const [liveCreateData, setLiveCreateData] = useState<LiveCase | null>(null);
	// Whether the user has turned the guide on outside practice mode. Persisted
	// so it survives reloads; practice mode shows the guide regardless.
	const [guideEnabled, setGuideEnabledState] =
		useState<boolean>(readGuideEnabled);

	const setGuideEnabled = useCallback((on: boolean) => {
		setGuideEnabledState(on);
		try {
			localStorage.setItem(GUIDE_ENABLED_KEY, on ? "true" : "false");
		} catch {
			// Non-fatal — the preference just won't persist across reloads.
		}
		// Turning the guide on should also reveal the sheet if it was hidden.
		if (on) setIsOpen(true);
	}, []);

	const value = useMemo<PracticeSheetValue>(
		() => ({
			isOpen,
			open: () => setIsOpen(true),
			close: () => setIsOpen(false),
			toggle: () => setIsOpen((v) => !v),
			guideEnabled,
			setGuideEnabled,
			liveCreateData,
			setLiveCreateData,
		}),
		[isOpen, guideEnabled, setGuideEnabled, liveCreateData]
	);
	return (
		<PracticeSheetContext.Provider value={value}>
			{children}
		</PracticeSheetContext.Provider>
	);
};
