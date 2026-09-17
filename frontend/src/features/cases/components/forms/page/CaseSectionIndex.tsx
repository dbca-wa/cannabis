import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import {
	CASE_SECTIONS,
	deriveCaseSectionStates,
	describeSectionState,
	type CaseSectionFlags,
	type CaseSectionId,
} from "../../../utils/caseSections";

interface CaseSectionIndexProps {
	/** Section currently in view. */
	activeId: string;
	/** The same flags the sections themselves are rendered from. */
	flags: CaseSectionFlags;
	/** Scroll the named section into view. */
	onSelect: (id: CaseSectionId) => void;
}

/**
 * Index of the case processing sections.
 *
 * Replaces the former step navigation: every section is already on the page, so
 * this only moves the viewport and reports progress. It reads the same flags the
 * section headings do, so the two can never disagree.
 */
export const CaseSectionIndex = ({
	activeId,
	flags,
	onSelect,
}: CaseSectionIndexProps) => {
	const states = deriveCaseSectionStates(flags);
	const completedCount = CASE_SECTIONS.filter(
		(section) => states[section.id] === "complete"
	).length;
	const attentionCount = CASE_SECTIONS.filter(
		(section) => states[section.id] === "attention"
	).length;

	return (
		<nav
			aria-label="Case sections"
			className="rounded-xl border bg-card shadow-sm"
		>
			<ol className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x">
				{CASE_SECTIONS.map((section, index) => {
					const state = states[section.id];
					const isActive = activeId === section.id;
					const reason = describeSectionState(section.id, flags);

					return (
						<li key={section.id} className="flex-1 min-w-0">
							<button
								type="button"
								onClick={() => onSelect(section.id)}
								aria-current={isActive ? "true" : undefined}
								title={reason ?? `${section.label} is complete`}
								className={cn(
									"group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
									isActive && "bg-accent/60",
									!isActive && "hover:bg-accent"
								)}
							>
								<span
									className={cn(
										"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
										state === "complete" &&
											"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
										state === "attention" &&
											"bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
										state === "notStarted" && "bg-muted text-muted-foreground"
									)}
								>
									{state === "complete" ? (
										<Check className="h-4 w-4" />
									) : state === "attention" ? (
										<AlertCircle className="h-4 w-4" />
									) : (
										<span>{index + 1}</span>
									)}
								</span>
								<span className="min-w-0">
									<span
										className={cn(
											"flex items-center gap-1.5 text-sm font-medium",
											state === "attention"
												? "text-red-700 dark:text-red-300"
												: "text-foreground"
										)}
									>
										<span className="truncate">{section.label}</span>
										{isActive && (
											<span
												aria-hidden="true"
												className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40"
											/>
										)}
									</span>
									<span
										className={cn(
											"block text-[11px] truncate",
											state === "attention"
												? "text-red-600 dark:text-red-400"
												: "text-muted-foreground"
										)}
									>
										{state === "complete"
											? "Complete"
											: (reason ?? section.description)}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
			<p className="sr-only" aria-live="polite">
				{completedCount} of {CASE_SECTIONS.length} sections complete
				{attentionCount > 0 && `, ${attentionCount} needing attention`}
			</p>
		</nav>
	);
};
