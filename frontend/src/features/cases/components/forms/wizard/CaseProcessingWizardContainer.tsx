import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useCaseProcessingWizardStore } from "@/app/providers/store.provider";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
	CASE_PROCESSING_STEPS,
	type StepState,
} from "@/app/stores/derived/case-processing-wizard.store";
import { PHASE_KEYS } from "@/shared/constants/phases.config";
import type { CasePhase } from "@/shared/types/backend-api.types";
import { FormPreviewToggle } from "./FormPreviewToggle";
import { WizardStepper } from "./WizardStepper";
import { WizardLayout } from "./WizardLayout";
import { WizardPreviewPanel } from "./WizardPreviewPanel";
import { WizardNavigation } from "./WizardNavigation";
import { CaseCreationSummaryStep } from "./steps/CaseCreationSummaryStep";
import { AssessmentStep } from "./steps/AssessmentStep";
import { UnsignedCertificateStep } from "./steps/UnsignedCertificateStep";

interface CaseProcessingWizardContainerProps {
	/** Case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Callback to persist field changes via mutation */
	onFieldChange: (field: string, value: unknown) => void;
	/** Callback to trigger a workflow action (advance_phase, generate_certificate) */
	onAction: (action: string) => void;
	/** Callback to finalise the case (advance to batching and exit) */
	onSubmit: () => void;
	/** Callback to discard the draft case */
	onDiscard: () => void;
}

/**
 * The workflow phase each wizard step corresponds to. Step 0 (Case Details) is
 * not a workflow phase, so it maps to null. Used to mark a step complete once
 * the case has advanced beyond it.
 */
const STEP_PHASE: (CasePhase | null)[] = [
	null,
	"assessment",
	"unsigned_generation",
];

// Completed cases are locked for non-admins: delete, regenerate, and finalise
// are disabled with this explanation.
const COMPLETE_LOCK_MESSAGE =
	"Only an administrator can delete, regenerate, or finalise a completed case.";

/**
 * Orchestrator for the case processing wizard.
 *
 * Steps:
 * 0 - Case Details (pre-completed summary, prefilled from the creation wizard)
 * 1 - Assessment (drug bags and botanical notes)
 * 2 - Certificate (generate the certificate PDF(s))
 *
 * Step 0 is not a workflow phase — cases start in the Assessment phase. After
 * certificate generation the case advances to the Batching phase, where it is
 * batched from the Cases page.
 */
export const CaseProcessingWizardContainer = observer(
	({
		caseData,
		onFieldChange,
		onAction,
		onSubmit,
		onDiscard,
	}: CaseProcessingWizardContainerProps) => {
		const store = useCaseProcessingWizardStore();
		const contentRef = useRef<HTMLDivElement>(null);
		const { isAdmin } = useAuth();
		// A completed case is read-only for non-admins.
		const lockForNonAdmin =
			(caseData?.phase as string) === "complete" && !isAdmin;
		// Tracks the last case for which we auto-advanced out of the assessment
		// phase, so the advance fires at most once per case.
		const assessmentAdvancedForCaseRef = useRef<number | null>(null);

		/** Step 0: case_number + received + submitting officer */
		const isStep0Valid = !!(
			caseData &&
			(caseData.case_number as string)?.trim() &&
			(caseData.received as string)?.trim() &&
			caseData.submitting_officer_id
		);

		/** Step 1: approved botanist set, every bag assessed, notes >= 4 chars */
		const isStep1Valid = !!(
			caseData &&
			caseData.approved_botanist_id &&
			Array.isArray(caseData.bags) &&
			(
				caseData.bags as Array<{
					assessment?: { determination?: string } | null;
				}>
			).length > 0 &&
			(
				caseData.bags as Array<{
					assessment?: { determination?: string } | null;
				}>
			).every(
				(bag) =>
					bag.assessment &&
					bag.assessment.determination &&
					bag.assessment.determination !== "pending"
			) &&
			typeof caseData.additional_notes === "string" &&
			caseData.additional_notes.trim().length >= 4
		);

		/** Step 2: at least one certificate generated */
		const isStep2Valid = !!(
			caseData &&
			Array.isArray(caseData.certificates) &&
			(caseData.certificates as unknown[]).length > 0
		);

		const currentPhaseIndex = PHASE_KEYS.indexOf(
			caseData?.phase as (typeof PHASE_KEYS)[number]
		);
		// A step is "past" once the case has advanced beyond that step's phase.
		// Step 0 (Case Details) has no phase, so it relies on field validity alone.
		const isPastStep = (stepIndex: number): boolean => {
			const stepPhase = STEP_PHASE[stepIndex];
			if (!stepPhase) return false;
			const phaseIndex = PHASE_KEYS.indexOf(stepPhase);
			return phaseIndex !== -1 && currentPhaseIndex > phaseIndex;
		};

		const stepValidities = useMemo(
			() => [
				isStep0Valid || isPastStep(0),
				isStep1Valid || isPastStep(1),
				isStep2Valid || isPastStep(2),
			],
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[isStep0Valid, isStep1Valid, isStep2Valid, currentPhaseIndex]
		);

		const stepStates: StepState[] = CASE_PROCESSING_STEPS.map((_, index) =>
			store.getStepState(index, stepValidities[index])
		);

		const stepDescriptions = CASE_PROCESSING_STEPS.map(
			(step) => step.description
		);
		const stepLabels = CASE_PROCESSING_STEPS.map((step) => step.label);

		const blockingStepIndex = store.getBlockingStepIndex(stepValidities);
		const isForwardBlocked = blockingStepIndex !== -1;

		useEffect(() => {
			if (caseData && !store.state.initialised) {
				store.initializeFromValidities(stepValidities);
			}
		}, [caseData, store, stepValidities]);

		// Keep the workflow phase in step with wizard progress. Reaching the
		// certificate step means the assessment is done, so advance the case out
		// of the assessment phase if it is still there (the wizard may have
		// auto-skipped the assessment "Continue" step). Guarded per case so it
		// fires exactly once — the phase only moves forward from here.
		useEffect(() => {
			const caseId = (caseData?.id as number | undefined) ?? null;
			if (
				caseData &&
				caseId !== null &&
				store.state.currentStep === 2 &&
				caseData.phase === "assessment" &&
				assessmentAdvancedForCaseRef.current !== caseId
			) {
				assessmentAdvancedForCaseRef.current = caseId;
				onAction("advance_phase");
			}
		}, [caseData, store.state.currentStep, onAction]);

		useEffect(() => {
			contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}, [store.state.currentStep]);

		const scrollToTop = useCallback(() => {
			contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}, []);

		const handleContinue = useCallback(() => {
			const current = store.state.currentStep;
			store.markStepTouched(current);

			if (isForwardBlocked) {
				store.goToStep(blockingStepIndex);
				scrollToTop();
				return;
			}

			if (stepValidities[current]) {
				// Phase progression is handled by the effect that advances the case
				// when it reaches the certificate step, so Continue just navigates.
				store.markStepCompleted(current);
				store.nextStep();
				scrollToTop();
			}
		}, [
			store,
			stepValidities,
			isForwardBlocked,
			blockingStepIndex,
			scrollToTop,
		]);

		const handleBack = useCallback(() => {
			store.previousStep();
			scrollToTop();
		}, [store, scrollToTop]);

		const handleFinalise = useCallback(() => {
			for (let i = 0; i < CASE_PROCESSING_STEPS.length; i++) {
				store.markStepTouched(i);
			}

			const firstInvalidIndex = stepValidities.findIndex((valid) => !valid);
			if (firstInvalidIndex !== -1) {
				store.goToStep(firstInvalidIndex);
				scrollToTop();
				return;
			}

			onSubmit();
		}, [store, stepValidities, scrollToTop, onSubmit]);

		const handleContinueOrFinalise = useCallback(() => {
			if (store.isLastStep) {
				handleFinalise();
			} else {
				handleContinue();
			}
		}, [store.isLastStep, handleContinue, handleFinalise]);

		const handleStepClick = useCallback(
			(stepIndex: number) => {
				store.goToStep(stepIndex);
				scrollToTop();
			},
			[store, scrollToTop]
		);

		const handleToggle = useCallback(
			(view: "form" | "preview") => {
				store.setShowPreview(view === "preview");
			},
			[store]
		);

		const isCertificateStep = store.state.currentStep === 2;

		// Completed cases are read-only for non-admins: wrap the editable steps in
		// a disabled fieldset (with a notice) so every control inside is locked.
		const renderLockable = (content: ReactNode) =>
			lockForNonAdmin ? (
				<div className="space-y-4">
					<div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
						This case is complete and read-only. Only an administrator can make
						changes.
					</div>
					<fieldset
						disabled
						className="pointer-events-none m-0 min-w-0 border-0 p-0 opacity-70"
					>
						{content}
					</fieldset>
				</div>
			) : (
				content
			);

		const renderStepContent = () => {
			const isTouched = store.state.touchedSteps.has(store.state.currentStep);

			switch (store.state.currentStep) {
				case 0:
					return renderLockable(
						<CaseCreationSummaryStep
							caseData={caseData}
							isTouched={isTouched}
							onFieldChange={onFieldChange}
						/>
					);
				case 1:
					return renderLockable(
						<AssessmentStep
							caseData={caseData}
							caseId={(caseData?.id as number) ?? 0}
							isTouched={isTouched}
							onFieldChange={onFieldChange}
						/>
					);
				case 2:
					return (
						<UnsignedCertificateStep
							caseData={caseData}
							caseId={(caseData?.id as number) ?? 0}
							onAction={onAction}
							lockActions={lockForNonAdmin}
							lockMessage={COMPLETE_LOCK_MESSAGE}
						/>
					);
				default:
					return null;
			}
		};

		return (
			<div className="flex flex-col gap-6 h-full">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tight">Process Case</h1>
					{!isCertificateStep && (
						<FormPreviewToggle
							activeView={store.state.showPreview ? "preview" : "form"}
							onToggle={handleToggle}
						/>
					)}
				</div>

				<WizardStepper
					currentStep={store.state.currentStep}
					stepStates={stepStates}
					onStepClick={handleStepClick}
					stepDescriptions={stepDescriptions}
					stepLabels={stepLabels}
				/>

				<div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto">
					<WizardLayout
						formPanel={renderStepContent()}
						previewPanel={
							isCertificateStep ? (
								renderStepContent()
							) : (
								<WizardPreviewPanel caseData={caseData} />
							)
						}
						showPreview={store.state.showPreview}
						fullWidthPreview={isCertificateStep}
					/>
				</div>

				<WizardNavigation
					currentStep={store.state.currentStep}
					isLastStep={store.isLastStep}
					isSubmitting={store.state.isSubmitting}
					onBack={handleBack}
					onContinue={handleContinueOrFinalise}
					onDiscard={onDiscard}
					lockActions={lockForNonAdmin}
					lockMessage={COMPLETE_LOCK_MESSAGE}
					discardLabel="Delete Case"
					discardModalTitle="Delete this case?"
					discardModalDescription="This will permanently delete the case and all associated drug bags and certificates. Defendants, officers, and users will not be affected. This action cannot be undone."
				/>
			</div>
		);
	}
);
