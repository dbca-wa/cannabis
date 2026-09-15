import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";

interface CaseSectionProps {
	/** Anchor id — also the target of the section index link. */
	id: string;
	title: string;
	description?: string;
	/** True once the section holds complete, valid data. */
	isComplete: boolean;
	/** True when the section has data that fails validation. */
	isInvalid?: boolean;
	/** Controls rendered to the right of the heading. */
	actions?: ReactNode;
	children: ReactNode;
}

/**
 * One section of the case processing page.
 *
 * Provides the anchor the section index scrolls to, a heading that labels the
 * section for assistive technology, and a completion indicator matching the
 * ticks used inside the section cards.
 */
export const CaseSection = ({
	id,
	title,
	description,
	isComplete,
	isInvalid = false,
	actions,
	children,
}: CaseSectionProps) => {
	const headingId = `${id}-heading`;

	return (
		<section
			id={id}
			aria-labelledby={headingId}
			// Offset the anchor so the sticky heading does not cover the target.
			className="scroll-mt-4"
		>
			<div className="flex items-start justify-between gap-4 border-b pb-3 mb-4">
				<div className="flex items-center gap-3 min-w-0">
					<span
						className={cn(
							"flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
							isInvalid
								? "bg-red-100 dark:bg-red-900/40"
								: isComplete
									? "bg-emerald-100 dark:bg-emerald-900/40"
									: "bg-muted"
						)}
					>
						{isInvalid ? (
							<X className="h-4 w-4 text-red-600 dark:text-red-400" />
						) : isComplete ? (
							<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
						{description && (
							<p className="text-xs text-muted-foreground truncate">
								{description}
							</p>
						)}
					</div>
					<span className="sr-only">
						{isInvalid
							? `${title} has errors`
							: isComplete
								? `${title} complete`
								: `${title} incomplete`}
					</span>
				</div>
				{actions && <div className="shrink-0">{actions}</div>}
			</div>

			{children}
		</section>
	);
};
