import { ClipboardList } from "lucide-react";

import { usePracticeMode } from "../hooks/usePracticeMode";
import { usePracticeSheet } from "./practiceSheet.context";

/**
 * A fixed tab on the right edge that reopens the guide once it has been hidden,
 * so it is never more than one click away. Shown in practice mode (reopens the
 * brief) and in the reference guide outside practice mode, whenever the sheet is
 * closed.
 */
export const PracticeSheetReopenTab = () => {
	const { isOn } = usePracticeMode();
	const { isOpen, open, guideEnabled } = usePracticeSheet();

	// The sheet is available either in practice mode or when the reference guide
	// is toggled on; show the reopen tab only then, and only while it is closed.
	const sheetAvailable = isOn || guideEnabled;
	if (!sheetAvailable || isOpen) return null;

	const label = isOn ? "Practice guide" : "Guide";

	return (
		<button
			type="button"
			onClick={open}
			className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 items-center gap-2 rounded-l-lg border border-r-0 border-amber-400 bg-amber-100 px-3 py-4 text-sm font-semibold text-amber-900 shadow-lg hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100 lg:flex [writing-mode:vertical-rl]"
			aria-label={`Show ${label.toLowerCase()}`}
		>
			<ClipboardList
				size={16}
				className="shrink-0 [writing-mode:horizontal-tb]"
			/>
			{label}
		</button>
	);
};
