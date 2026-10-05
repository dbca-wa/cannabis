import { ClipboardList } from "lucide-react";

import { usePracticeMode } from "../hooks/usePracticeMode";
import { usePracticeSheet } from "./practiceSheet.context";

/**
 * A fixed tab on the right edge that reopens the practice guide once it has been
 * hidden, so the brief is never more than one click away. Only in practice mode
 * and only when the sheet is closed.
 */
export const PracticeSheetReopenTab = () => {
	const { isOn } = usePracticeMode();
	const { isOpen, open } = usePracticeSheet();

	if (!isOn || isOpen) return null;

	return (
		<button
			type="button"
			onClick={open}
			className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 items-center gap-2 rounded-l-lg border border-r-0 border-amber-400 bg-amber-100 px-3 py-4 text-sm font-semibold text-amber-900 shadow-lg hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100 lg:flex [writing-mode:vertical-rl]"
			aria-label="Show practice guide"
		>
			<ClipboardList
				size={16}
				className="shrink-0 [writing-mode:horizontal-tb]"
			/>
			Practice guide
		</button>
	);
};
