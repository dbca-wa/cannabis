import { Hand } from "lucide-react";
import { motion } from "motion/react";

import { usePracticeMode } from "../hooks/usePracticeMode";
import { usePracticeSheet } from "./practiceSheet.context";

interface PracticeActionPromptProps {
	/** Short nudge, e.g. "Start here — create your practice case". */
	message: string;
}

/**
 * A floating, attention-drawing prompt placed next to a key action (e.g. the
 * New Case button) in practice mode. It pulses to catch the eye and, when
 * clicked, opens the practice guide so the user always has their brief to hand.
 * Renders nothing outside practice mode.
 */
export const PracticeActionPrompt = ({
	message,
}: PracticeActionPromptProps) => {
	const { isOn } = usePracticeMode();
	const { open } = usePracticeSheet();

	if (!isOn) return null;

	return (
		<motion.button
			type="button"
			onClick={open}
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: [1, 1.04, 1] }}
			transition={{
				opacity: { duration: 0.2 },
				scale: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
			}}
			className="inline-flex items-center gap-2 rounded-full border-2 border-amber-400 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg shadow-amber-500/30 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100"
		>
			<Hand size={16} className="shrink-0" aria-hidden="true" />
			{message}
		</motion.button>
	);
};
