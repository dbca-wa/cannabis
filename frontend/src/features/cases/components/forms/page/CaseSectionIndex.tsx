import { Check } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import {
	CASE_SECTIONS,
	type CaseSectionId,
	type CaseSectionValidity,
} from "../../../utils/caseSections";

interface CaseSectionIndexProps {
	/** Section currently in view. */
	activeId: string;
	validity: CaseSectionValidity;
	/** Scroll the named section into view. */
	onSelect: (id: CaseSectionId) => void;
}

/**
 * Horizontal index of the case processing sections.
 *
 * Replaces the former step navigation: every section is already on the page, so
 * this only moves the viewport and reports progress. Rendered as a list of
 * buttons that scroll rather than links, since the target is on the same page
 * and a fragment change would add spurious history entries.
 */
export const CaseSectionIndex = ({
	activeId,
	validity,
	onSelect,
}: CaseSectionIndexProps) => {
	const completedCount = CASE_SECTIONS.filter(
		(section) => validity[section.id]
	).length;

	return (
		<nav
			aria-label="Case sections"
			className="rounded-xl border bg-card shadow-sm"
		>
			<ol className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x">
				{CASE_SECTIONS.map((section, index) => {
					const isComplete = validity[section.id];
					const isActive = activeId === section.id;

					return (
						<li key={section.id} className="flex-1 min-w-0">
							<button
								type="button"
								onClick={() => onSelect(section.id)}
								aria-current={isActive ? "true" : undefined}
								className={cn(
									"group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
									isActive
										? "bg-emerald-50 dark:bg-emerald-950/40"
										: "hover:bg-accent"
								)}
							>
								<span
									className={cn(
										"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
										isComplete
											? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
											: isActive
												? "bg-emerald-600 text-white"
												: "bg-muted text-muted-foreground"
									)}
								>
									{isComplete ? (
										<Check className="h-4 w-4" />
									) : (
										<span>{index + 1}</span>
									)}
								</span>
								<span className="min-w-0">
									<span
										className={cn(
											"block text-sm font-medium truncate",
											isActive
												? "text-emerald-800 dark:text-emerald-200"
												: "text-foreground"
										)}
									>
										{section.label}
									</span>
									<span className="block text-[11px] text-muted-foreground truncate">
										{isComplete ? "Complete" : section.description}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
			<p className="sr-only" aria-live="polite">
				{completedCount} of {CASE_SECTIONS.length} sections complete
			</p>
		</nav>
	);
};
