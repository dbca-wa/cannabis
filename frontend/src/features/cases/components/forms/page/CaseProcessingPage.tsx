import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

import { useCaseProcessingPageStore } from "@/app/providers/store.provider";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/components/ui/button";
import { useActiveSection } from "@/shared/hooks/ui/useActiveSection";
import type { Priority3Form } from "@/shared/types/backend-api.types";

import {
	CASE_SECTIONS,
	deriveCaseSectionFlags,
	deriveCaseSectionStates,
	describeSectionState,
	firstIncompleteSection,
	type CaseSectionId,
} from "../../../utils/caseSections";
import { FormsNavigator } from "../FormsNavigator";
import { CaseSection } from "./CaseSection";
import { CaseSectionIndex } from "./CaseSectionIndex";
import { FormPreviewToggle } from "../wizard/FormPreviewToggle";
import { WizardPreviewPanel } from "../wizard/WizardPreviewPanel";
import { CaseCreationSummaryStep } from "../wizard/steps/CaseCreationSummaryStep";
import { AssessmentStep } from "../wizard/steps/AssessmentStep";
import { UnsignedCertificateStep } from "../wizard/steps/UnsignedCertificateStep";

interface CaseProcessingPageProps {
	/** Case data (with form-scoped bags/certificate/phase) from TanStack Query */
	caseData: Record<string, unknown> | null;
	caseId: number;
	activeFormId: number;
	/** All forms on the case, for case-level validity */
	forms?: Priority3Form[];
	onFieldChange: (field: string, value: unknown) => void;
	/** Finalise the case: advance every form to batching and leave */
	onSubmit: () => void;
	/** Leave the case without finalising */
	onDiscard: () => void;
	/** Delete the whole case and its unique data (opens a confirmation) */
	onDelete: () => void;
	onFormSelect?: (formId: number) => void;
	onAddForm?: () => void;
	onDeleteForm?: (formId: number) => void;
}

// Completed forms are locked for non-admins.
const COMPLETE_LOCK_MESSAGE =
	"Only an administrator can regenerate or finalise a completed form.";

/**
 * The case processing page.
 *
 * Presents case details, assessment and certificates as sections of one page.
 * Progress is reported by per-section ticks and the section index rather than
 * gated by step navigation, so a user can correct anything at any time.
 */
export const CaseProcessingPage = observer(
	({
		caseData,
		caseId,
		activeFormId,
		forms,
		onFieldChange,
		onSubmit,
		onDiscard,
		onDelete,
		onFormSelect,
		onAddForm,
		onDeleteForm,
	}: CaseProcessingPageProps) => {
		const store = useCaseProcessingPageStore();
		const { isAdmin } = useAuth();

		// Certificate readiness is owned by the certificate section, which tracks
		// the per-form ready marks.
		const [allFormsReady, setAllFormsReady] = useState(false);

		const lockForNonAdmin =
			(caseData?.phase as string) === "complete" && !isAdmin;

		const flags = useMemo(
			() => deriveCaseSectionFlags(caseData, forms),
			[caseData, forms]
		);

		const validity = useMemo(
			() => ({
				details: flags.details,
				assessment: flags.assessment,
				certificates: flags.certificates,
			}),
			[flags.details, flags.assessment, flags.certificates]
		);

		// One derivation drives both the index and the section headings, so they
		// cannot report different things.
		const sectionStates = useMemo(
			() => deriveCaseSectionStates(flags),
			[flags]
		);

		const sectionIds = useMemo(
			() => CASE_SECTIONS.map((section) => section.id),
			[]
		);

		// The page scrolls within the layout's main region, so sections move
		// relative to the viewport and the observer needs no explicit root.
		const activeSectionId = useActiveSection({ sectionIds });

		const scrollToSection = useCallback((sectionId: CaseSectionId) => {
			document
				.getElementById(sectionId)
				?.scrollIntoView({ behavior: "smooth", block: "start" });
		}, []);

		// Honour a section jump requested from elsewhere (currently the finalise
		// action), then clear it so the user's own scrolling takes over again.
		useEffect(() => {
			const requested = store.state.requestedSection;
			if (!requested) return;
			scrollToSection(requested);
			store.clearRequestedSection();
		}, [store, store.state.requestedSection, scrollToSection]);

		const handleSectionSelect = useCallback(
			(sectionId: CaseSectionId) => {
				scrollToSection(sectionId);
			},
			[scrollToSection]
		);

		const handleFinalise = useCallback(() => {
			const incomplete = firstIncompleteSection(validity);
			if (incomplete) {
				store.requestSection(incomplete);
				return;
			}
			onSubmit();
		}, [validity, store, onSubmit]);

		const handlePreviewToggle = useCallback(
			(view: "form" | "preview") => {
				store.setShowPreview(view === "preview");
			},
			[store]
		);

		// The preview only says anything once the active form has a bag.
		const hasPreviewContent = !!(
			caseData?.formId &&
			Array.isArray(caseData?.bags) &&
			(caseData.bags as unknown[]).length > 0
		);

		/** Wrap editable content so a completed form is read-only for non-admins. */
		const renderLockable = (content: ReactNode) =>
			lockForNonAdmin ? (
				<fieldset
					disabled
					className="pointer-events-none m-0 min-w-0 border-0 p-0 opacity-70"
				>
					{content}
				</fieldset>
			) : (
				content
			);

		const canFinalise =
			flags.hasForms &&
			flags.allFormsHaveBags &&
			// A stale certificate would batch an out-of-date document.
			!flags.certificatesStale &&
			allFormsReady;

		const finaliseTitle = lockForNonAdmin
			? COMPLETE_LOCK_MESSAGE
			: !flags.hasForms
				? "Add a Priority 3 form before finalising"
				: !flags.allFormsHaveBags
					? "Every form needs at least one drug bag"
					: flags.certificatesStale
						? "A certificate is out of date — regenerate it before finalising"
						: !allFormsReady
							? "Generate every certificate and mark each form ready before finalising"
							: undefined;

		return (
			// Scrolls in the layout's main region like every other page. A nested
			// scroll container here fought the layout for the scroll and reset the
			// reader's position whenever it remounted.
			<div className="space-y-6">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 min-w-0">
						<Button
							variant="outline"
							size="icon"
							onClick={onDiscard}
							aria-label="Back to cases"
							title="Back to cases"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<h1 className="text-2xl font-bold tracking-tight truncate">
							Process Case
						</h1>
					</div>

					{/* Deleting is a rare, destructive action, so it sits apart from
					    the primary workflow controls with muted styling and its own
					    typed-confirmation step in the dialog it opens. */}
					<Button
						variant="ghost"
						size="sm"
						onClick={onDelete}
						className="shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete case
					</Button>
				</div>

				{/* Stays reachable on a long page. */}
				<div className="sticky top-0 z-20 -mx-1 bg-[#fafbfb]/95 px-1 py-2 backdrop-blur dark:bg-background/95">
					<CaseSectionIndex
						activeId={activeSectionId}
						flags={flags}
						onSelect={handleSectionSelect}
					/>
				</div>

				{lockForNonAdmin && (
					<div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
						This form is complete and read-only. Only an administrator can make
						changes.
					</div>
				)}

				<div className="space-y-10 pb-10">
					<CaseSection
						id="details"
						title="Case Details"
						description="Reference, dates, defendants and officers"
						state={sectionStates.details}
						reason={describeSectionState("details", flags)}
					>
						{renderLockable(
							<CaseCreationSummaryStep
								caseData={caseData}
								isTouched
								onFieldChange={onFieldChange}
							/>
						)}
					</CaseSection>

					<CaseSection
						id="assessment"
						title="Priority Form Assessment"
						description="Priority 3 forms and their drug bags"
						state={sectionStates.assessment}
						reason={describeSectionState("assessment", flags)}
						// The Form/Preview switch lives here because it acts on the
						// selected form and the preview it toggles renders in this
						// section.
						actions={
							hasPreviewContent ? (
								<FormPreviewToggle
									activeView={store.state.showPreview ? "preview" : "form"}
									onToggle={handlePreviewToggle}
								/>
							) : undefined
						}
					>
						<div className="space-y-4">
							<FormsNavigator
								caseId={caseId}
								activeFormId={activeFormId}
								onFormSelect={onFormSelect ?? (() => {})}
								onAddForm={onAddForm ?? (() => {})}
								onDeleteForm={onDeleteForm}
							/>

							{hasPreviewContent && store.state.showPreview ? (
								// Sole panel — fill the section rather than cap at the
								// form's reading width.
								<WizardPreviewPanel caseData={caseData} />
							) : (
								<div className="min-[1920px]:grid min-[1920px]:grid-cols-2 min-[1920px]:gap-8">
									{/* Fills the section width like Case Details; only
									    shares the row with the preview on ultra-wide. */}
									<div className="min-w-0">
										{renderLockable(
											<AssessmentStep
												caseData={caseData}
												caseId={(caseData?.id as number) ?? 0}
												isTouched
												onFieldChange={onFieldChange}
												onAddForm={onAddForm}
											/>
										)}
									</div>
									{hasPreviewContent && (
										<div className="hidden min-[1920px]:block min-w-0 border-l pl-8">
											<WizardPreviewPanel caseData={caseData} />
										</div>
									)}
								</div>
							)}
						</div>
					</CaseSection>

					<CaseSection
						id="certificates"
						title="Certificates"
						description="Generate and review each form's certificate"
						state={sectionStates.certificates}
						reason={describeSectionState("certificates", flags)}
					>
						<UnsignedCertificateStep
							caseId={caseId}
							lockActions={lockForNonAdmin}
							lockMessage={COMPLETE_LOCK_MESSAGE}
							onAllReadyChange={setAllFormsReady}
						/>
					</CaseSection>

					{/*
					  The final action sits at the end of the last section, the
					  natural place to commit once every section above has been
					  worked through.
					*/}
					<div className="flex flex-col items-end gap-2 border-t pt-6">
						{finaliseTitle && (
							<p className="text-sm text-muted-foreground text-right">
								{finaliseTitle}
							</p>
						)}
						<Button
							size="lg"
							onClick={handleFinalise}
							disabled={
								!canFinalise || store.state.isSubmitting || lockForNonAdmin
							}
							title={finaliseTitle}
							className="min-h-11 bg-cannabis-green-dark hover:bg-cannabis-green-dark/90"
						>
							{store.state.isSubmitting && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Finalise Case
						</Button>
					</div>
				</div>
			</div>
		);
	}
);
