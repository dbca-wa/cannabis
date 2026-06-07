import { motion } from "motion/react";
import type { ReactNode } from "react";

interface PageTransitionProps {
	children: ReactNode;
	className?: string;
}

/**
 * PageTransition — Wraps content with a fade-in + slide-up animation on mount.
 *
 * Use this inside tab content components, page sections, or any content
 * that should animate in when it appears. This replaces the old page-level
 * AnimatePresence in MainLayout, giving each section control over its own
 * entrance animation.
 */
export const PageTransition = ({
	children,
	className,
}: PageTransitionProps) => (
	<motion.div
		initial={{ opacity: 0, y: 8 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.25, ease: "easeOut" }}
		className={className}
	>
		{children}
	</motion.div>
);
