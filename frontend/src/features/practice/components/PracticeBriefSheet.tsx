import {
	ClipboardList,
	X,
	Check,
	Circle,
	ChevronRight,
	ChevronLeft,
} from "lucide-react";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { getCaseById, getCases } from "@/features/cases/services/cases.service";
import { getCaseForms } from "@/features/cases/services/forms.service";
import type {
	CasePhase,
	Priority3FormTiny,
} from "@/features/cases/types/cases.types";
import { usePracticeMode } from "../hooks/usePracticeMode";
import { usePracticeBrief } from "../hooks/usePracticeBrief";
import { usePracticeSheet } from "./practiceSheet.context";
import {
	getPracticeGuidance,
	derivePracticeStep,
	type PracticeFormProgress,
} from "../utils/practiceGuidance";
import {
	buildCaseChecklist,
	buildFormChecklists,
	areFormChecklistsComplete,
	type ChecklistGroup,
	type LiveCase,
} from "../utils/practiceProgress";

/** The case id in the current path, if we are on a case page. */
const caseIdFromPath = (pathname: string): number | null => {
	const m = pathname.match(/^\/cases\/(\d+)/);
	return m ? Number(m[1]) : null;
};

interface StepTrackerProps {
	steps: {
		number: number;
		title: string;
		current: boolean;
		done: boolean;
	}[];
}

/** Compact 1–6 journey tracker so the user always sees overall progress. */
const StepTracker = ({ steps }: StepTrackerProps) => (
	<ol className="space-y-1" aria-label="Practice progress">
		{steps.map((s) => (
			<li key={s.number} className="flex items-center gap-2">
				<span
					className={
						"flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
						(s.done
							? "bg-emerald-600 text-white dark:bg-emerald-500"
							: s.current
								? "bg-amber-600 text-white dark:bg-amber-500"
								: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200")
					}
					aria-hidden="true"
				>
					{s.done ? <Check size={12} /> : s.number}
				</span>
				<span
					className={
						"text-[13px] " +
						(s.current
							? "font-semibold text-amber-900 dark:text-amber-100"
							: s.done
								? "text-emerald-800 dark:text-emerald-300"
								: "text-amber-800/70 dark:text-amber-100/60")
					}
				>
					{s.title}
					{s.current && <span className="sr-only"> (current step)</span>}
				</span>
			</li>
		))}
	</ol>
);

interface ChecklistProps {
	group: ChecklistGroup;
}

const Checklist = ({ group }: ChecklistProps) => (
	<div>
		<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
			{group.title}
		</h3>
		<ul className="space-y-1.5">
			{group.items.map((item) => (
				<li key={item.label} className="flex items-start gap-2">
					{item.done ? (
						<Check
							size={16}
							className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
							aria-hidden="true"
						/>
					) : (
						<Circle
							size={16}
							className="mt-0.5 shrink-0 text-amber-500/70"
							aria-hidden="true"
						/>
					)}
					<span
						className={
							item.done
								? "text-emerald-800 line-through decoration-emerald-600/50 dark:text-emerald-300"
								: "text-amber-900 dark:text-amber-100"
						}
					>
						<span className="font-medium">{item.label}</span>
						{item.expected && (
							<>
								{": "}
								<span className="font-mono text-[13px]">{item.expected}</span>
							</>
						)}
						<span className="sr-only">{item.done ? " (done)" : ""}</span>
					</span>
				</li>
			))}
		</ul>
	</div>
);

/**
 * Always-accessible practice guide, docked on the right. Shows what to do on the
 * current page, then a live checklist of the fake Priority 3 brief that ticks
 * off as the user enters matching data. Split into case-level items (entered
 * when creating the case) and per-form items (SME and drug bags). Sits above
 * modal overlays so it stays readable while a dialog is open.
 */
export const PracticeBriefSheet = () => {
	const { isOn } = usePracticeMode();
	const { isOpen, close, liveCreateData } = usePracticeSheet();
	const { data: brief, index, total, next, previous } = usePracticeBrief(isOn);
	const { pathname } = useLocation();

	const caseId = caseIdFromPath(pathname);

	// Read the live case + forms so the checklist can tick off. Only while on a
	// case page and in practice mode; kept fresh so edits reflect quickly.
	const { data: liveCase } = useQuery({
		queryKey: ["cases", "detail", caseId],
		queryFn: () => getCaseById(caseId!),
		enabled: isOn && isOpen && caseId != null,
		staleTime: 10_000,
	});
	const { data: liveForms } = useQuery({
		queryKey: ["cases", caseId, "forms"],
		queryFn: () => getCaseForms(caseId!),
		enabled: isOn && isOpen && caseId != null,
		staleTime: 10_000,
	});

	// When not on a specific case page, track the user's one active practice
	// case so the step tracker keeps advancing (e.g. after finalising returns
	// the user to the cases list). Practice mode scopes this list to the user's
	// own practice cases, so the most-advanced one is the case in play.
	const { data: practiceCases } = useQuery({
		queryKey: ["cases", "practice-progress"],
		queryFn: () => getCases({ limit: 20 }),
		enabled: isOn && isOpen && caseId == null,
		staleTime: 10_000,
	});

	if (!isOn || !isOpen || !brief) return null;

	// On the new-case form the data lives in memory (liveCreateData); on a saved
	// case it comes from the query cache. Prefer whichever is present.
	const caseSource: LiveCase | null =
		liveCreateData ?? (liveCase as LiveCase | undefined) ?? null;
	const caseChecklist = buildCaseChecklist(brief, caseSource);
	const formChecklists = buildFormChecklists(
		brief,
		Array.isArray(liveForms) ? liveForms : []
	);

	// Derive the current step from live progress so the tracker follows the case
	// from creation through to invoicing, rather than resetting per page.
	const toFormProgress = (
		forms:
			| Array<{
					phase: CasePhase;
					marked_ready: boolean;
					certificate?: { id: number } | null;
			  }>
			| undefined
	): PracticeFormProgress[] =>
		(forms ?? []).map((f) => ({
			phase: f.phase,
			marked_ready: f.marked_ready,
			certificate: f.certificate ? { id: f.certificate.id } : null,
		}));

	let step: number;
	if (caseId != null && liveCase) {
		const formsForProgress = Array.isArray(liveForms)
			? liveForms
			: liveCase.forms;
		step = derivePracticeStep({
			caseExists: true,
			derivedStatus: liveCase.derived_status,
			forms: toFormProgress(formsForProgress),
			// Advance to "generate certificates" once every per-form brief item
			// is recorded, even before a certificate exists.
			formsRecorded: areFormChecklistsComplete(
				brief,
				Array.isArray(liveForms) ? liveForms : []
			),
		});
	} else if (caseId == null && practiceCases?.results?.length) {
		// Pick the most-advanced practice case as the one in play.
		const steps = practiceCases.results.map((c) =>
			derivePracticeStep({
				caseExists: true,
				derivedStatus: c.derived_status,
				forms: toFormProgress(c.forms as Priority3FormTiny[]),
			})
		);
		step = Math.max(...steps);
	} else if (liveCreateData) {
		// On the create form, filling fields in — still step 1.
		step = 1;
	} else {
		step = 1;
	}

	const guidance = getPracticeGuidance(pathname, step);

	return (
		<aside
			aria-label="Practice brief and guidance"
			// z-index above the modal overlay (shadcn dialogs sit at z-50) so the
			// brief stays visible while a dialog such as Add Officer is open.
			className="fixed right-0 top-0 z-[60] hidden h-full w-[360px] shrink-0 flex-col overflow-y-auto border-l border-amber-300 bg-amber-50 shadow-2xl dark:border-amber-800 dark:bg-amber-950/95 lg:flex"
		>
			<div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
				<h2 className="flex items-center gap-2 text-base font-semibold text-amber-900 dark:text-amber-100">
					<ClipboardList size={18} aria-hidden="true" />
					Practice guide
				</h2>
				<Button
					size="icon"
					variant="ghost"
					className="h-7 w-7 text-amber-900 hover:bg-amber-200 dark:text-amber-100"
					onClick={close}
					aria-label="Hide practice guide"
				>
					<X size={16} />
				</Button>
			</div>

			<div className="space-y-5 px-4 py-4 text-sm">
				{/* Overall journey tracker — always visible so the user sees where
				    they are from create through to invoice. */}
				<section>
					<div className="mb-2 flex items-center justify-between">
						<h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
							Your progress
						</h3>
						<span className="text-xs tabular-nums text-amber-800 dark:text-amber-200">
							Step {guidance.currentStep} of {guidance.steps.length}
						</span>
					</div>
					<StepTracker steps={guidance.steps} />
				</section>

				<section className="border-t border-amber-300 pt-4 dark:border-amber-800">
					<h3 className="mb-2 text-[15px] font-semibold text-amber-900 dark:text-amber-100">
						{guidance.heading}
					</h3>
					<ol className="space-y-2">
						{guidance.instructions.map((line, i) => (
							<li
								key={i}
								className="flex gap-2 text-amber-900/90 dark:text-amber-100/90"
							>
								<ChevronRight
									size={16}
									className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
									aria-hidden="true"
								/>
								<span>{line}</span>
							</li>
						))}
					</ol>
				</section>

				{/* Live checklist of the brief, ticking off as data is entered. */}
				<section className="space-y-4 border-t border-amber-300 pt-4 dark:border-amber-800">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<h3 className="text-[15px] font-semibold text-amber-900 dark:text-amber-100">
								Your Priority 3 brief
							</h3>
							<Badge variant="secondary">Fake data</Badge>
						</div>
						{total > 1 && (
							<div className="flex items-center gap-1">
								<Button
									size="icon"
									variant="outline"
									className="h-7 w-7 border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-transparent dark:text-amber-100"
									onClick={previous}
									aria-label="Previous example"
								>
									<ChevronLeft size={16} />
								</Button>
								<span className="text-xs tabular-nums text-amber-800 dark:text-amber-200">
									{index + 1}/{total}
								</span>
								<Button
									size="icon"
									variant="outline"
									className="h-7 w-7 border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-transparent dark:text-amber-100"
									onClick={next}
									aria-label="Next example"
								>
									<ChevronRight size={16} />
								</Button>
							</div>
						)}
					</div>
					<p className="text-xs text-amber-800/80 dark:text-amber-100/70">
						This is practice data. In real work it would come from an official
						Priority 3 form. Items tick off as you enter them from your brief
						below. The approved botanist is the default one, already selected
						for you — leave it as is. Use the arrows to try a different example.
					</p>

					<Checklist group={caseChecklist} />
					{formChecklists.map((group) => (
						<Checklist key={group.title} group={group} />
					))}
				</section>
			</div>
		</aside>
	);
};
