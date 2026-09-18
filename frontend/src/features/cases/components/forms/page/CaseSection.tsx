import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import type { CaseSectionState } from "../../../utils/caseSections";

interface CaseSectionProps {
	/** Anchor id — also the target of the section index link. */
	id: string;
	title: string;
	description?: string;
	/** Presentation state, derived from the same flags the index uses. */
	state: CaseSectionState;
	/** Plain-language reason the section is not complete, when it is not. */
	reason?: string | null;
	/** Controls rendered to the right of the heading. */
	actions?: ReactNode;
	children: ReactNode;
}

/**
 * One section of the case processing page.
 *
 * Provides the anchor the section index scrolls to, a heading that labels the
 * section for assistive technology, and a status that always agrees with the
 * index because both are derived from the same flags.
 */
export const CaseSection = ({
	id,
	title,
	description,
	state,
	reason = null,
	actions,
	children,
}: CaseSectionProps) => {
	const headingId = `${id}-heading`;

	return (
		<section
			id={id}
			aria-labelledby={headingId}
			// Clears the sticky section index when scrolled to.
			className="scroll-mt-24"
		>
			<div className="flex items-start justify-between gap-4 border-b pb-3 mb-4">
				<div className="flex items-center gap-3 min-w-0">
					<span
						className={cn(
							"flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
							state === "complete" && "bg-emerald-100 dark:bg-emerald-900/40",
							state === "attention" && "bg-red-100 dark:bg-red-900/40",
							state === "notStarted" && "bg-muted"
						)}
					>
						{state === "complete" ? (
							<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
						) : state === "attention" ? (
							<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
						) : (
							<span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
						)}
					</span>
					<div className="min-w-0">
						<h2
							id={headingId}
							className="text-lg font-semibold tracking-tight truncate"
						>
							{title}
						</h2>
						<p
							className={cn(
								"text-xs truncate",
								state === "attention"
									? "text-red-600 dark:text-red-400"
									: "text-muted-foreground"
							)}
						>
							{reason ?? description}
						</p>
					</div>
					<span className="sr-only">
						{state === "complete"
							? `${title} complete`
							: state === "attention"
								? `${title} needs attention`
								: `${title} not started`}
					</span>
				</div>
				{actions && <div className="shrink-0">{actions}</div>}
			</div>

			{children}
		</section>
	);
};
