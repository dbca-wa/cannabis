import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { observer } from "mobx-react-lite";
import { useCaseProcessingWizardStore } from "@/app/providers/store.provider";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
	CASE_PROCESSING_STEPS,
	type StepState,
} from "@/app/stores/derived/case-processing-wizard.store";
import { FormsNavigator } from "../FormsNavigator";
import { FormPreviewToggle } from "./FormPreviewToggle";
import { WizardStepper } from "./WizardStepper";
import { WizardLayout } from "./WizardLayout";
import { WizardPreviewPanel } from "./WizardPreviewPanel";
import { WizardNavigation } from "./WizardNavigation";
import { CaseCreationSummaryStep } from "./steps/CaseCreationSummaryStep";
import { AssessmentStep } from "./steps/AssessmentStep";
import { UnsignedCertificateStep } from "./steps/UnsignedCertificateStep";

interface CaseProcessingWizardContainerProps {
	/** Case data (with form-scoped bags/certificate/phase) from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Case ID for the FormsNavigator */
	caseId: number;
	/** Active form ID for the FormsNavigator */
	activeFormId: number;
	/** All forms on the case (for cross-form validation) */
	forms?: Array<{
		id: number;
		bags?: Array<unknown>;
		certificate?: unknown | null;
	}>;
	/** Callback to persist field changes via mutation */
	onFieldChange: (field: string, value: unknown) => void;
	/** Callback to trigger a workflow action (advance_phase, generate_certificate) */
	onAction: (action: string) => void;
	/** Callback to finalise the form (advance to batching and exit) */
	onSubmit: () => void;
	/** Callback to discard/leave the form */
	onDiscard: () => void;
	/** Callback when a form is selected in the FormsNavigator */
	onFormSelect?: (formId: number) => void;
	/** Callback when the "Add Form" button is clicked */
	onAddForm?: () => void;
	/** Callback when a form is deleted in the FormsNavigator */
	onDeleteForm?: (formId: number) => void;
}

// Completed forms are locked for non-admins: regenerate and finalise are
// disabled with this explanation.
const COMPLETE_LOCK_MESSAGE =
	"Only an administrator can regenerate or finalise a completed form.";

/**
 * Orchestrator for the case processing wizard (form-scoped).
 *
 * Steps:
 * 0 - Case Details (pre-completed summary, prefilled from the creation wizard)
 * 1 - Assessment (form's drug bags and botanical notes)
 * 2 - Certificate (generate and preview the form's single certificate)
 *
 * Step 0 is not a workflow phase — forms start in the Assessment phase. After
 * certificate generation the form advances to the Batching phase.
 */
export const CaseProcessingWizardContainer = observer(
	({
		caseData,
		caseId,
		activeFormId,
		forms,
		onFieldChange,
		onAction,
		onSubmit,
		onDiscard,
		onFormSelect,
		onAddForm,
		onDeleteForm,
	}: CaseProcessingWizardContainerProps) => {
		const store = useCaseProcessingWizardStore();
		const contentRef = useRef<HTMLDivElement>(null);
		const { isAdmin } = useAuth();
		// A completed form is read-only for non-admins.
		const lockForNonAdmin =
			(caseData?.phase as string) === "complete" && !isAdmin;
		// Tracks the last form for which we auto-advanced out of the assessment
		// phase, so the advance fires at most once per form.
		const assessmentAdvancedForFormRef = useRef<number | null>(null);

		// Tracks whether all forms on the Certificate step have been marked ready
		const [allFormsReady, setAllFormsReady] = useState(false);

		/** Step 0: case_number + received + submitting officer + approved botanist */
		const isStep0Valid = !!(
			caseData &&
			(caseData.case_number as string)?.trim() &&
			(caseData.received as string)?.trim() &&
			caseData.submitting_officer_id &&
			caseData.approved_botanist_id
		);

		/** Case-level: true when no forms exist OR all forms have ≥1 bag. */
		const allFormsHaveBags =
			!forms ||
			forms.length === 0 ||
			forms.every((f) => (f.bags?.length ?? 0) > 0);

		/** Case-level: true when all forms have all bags assessed (determination not pending).
		 * Checks across ALL forms, not just the active one. */
		const allBagsAssessed = !!(
			forms &&
			forms.length > 0 &&
			forms.every((f) => {
				const bags = (f.bags ?? []) as Array<{
					assessment?: { determination?: string } | null;
				}>;
				return (
					bags.length > 0 &&
					bags.every(
						(bag) =>
							bag.assessment &&
							bag.assessment.determination &&
							bag.assessment.determination !== "pending"
					)
				);
			})
		);

		/** Step 1 (Assessment): all forms have bags AND all bags assessed.
		 * Section C notes are NOT required — they default to "None". */
		const isStep1Valid = allFormsHaveBags && allBagsAssessed;

		/** Case-level: true when ALL forms have a certificate generated. */
		const allFormsHaveCerts = !!(
			forms &&
			forms.length > 0 &&
			forms.every((f) => !!f.certificate)
		);

		/** Step 2 (Certificate): all forms have a cert. */
		const isStep2Valid = allFormsHaveCerts;

		const stepValidities = useMemo(
			() => [isStep0Valid, isStep1Valid, isStep2Valid],
			[isStep0Valid, isStep1Valid, isStep2Valid]
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
				// Auto-advance past already-completed steps
				if (stepValidities[0] && store.state.currentStep === 0) {
					store.markStepCompleted(0);
					store.nextStep();
				}
			}
		}, [caseData, store, stepValidities]);

		// Keep the workflow phase in step with wizard progress. Reaching the
		// certificate step means the assessment is done, so advance the form out
		// of the assessment phase if it is still there.
		useEffect(() => {
			const formId = (caseData?.formId as number | undefined) ?? null;
			if (
				caseData &&
				formId !== null &&
				store.state.currentStep === 2 &&
				caseData.phase === "assessment" &&
				assessmentAdvancedForFormRef.current !== formId
			) {
				assessmentAdvancedForFormRef.current = formId;
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

		// Preview is only meaningful when there's an active form with at least one bag
		const hasPreviewContent = !!(
			caseData?.formId &&
			Array.isArray(caseData?.bags) &&
			(caseData.bags as unknown[]).length > 0
		);

		// Completed forms are read-only for non-admins: wrap the editable steps in
		// a disabled fieldset (with a notice) so every control inside is locked.
		const renderLockable = (content: ReactNode) =>
			lockForNonAdmin ? (
				<div className="space-y-4">
					<div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
						This form is complete and read-only. Only an administrator can make
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
							onAddForm={onAddForm}
						/>
					);
				case 2:
					return (
						<UnsignedCertificateStep
							caseData={caseData}
							caseId={(caseData?.id as number) ?? 0}
							formId={(caseData?.formId as number) ?? 0}
							onAction={onAction}
							lockActions={lockForNonAdmin}
							lockMessage={COMPLETE_LOCK_MESSAGE}
							onAllReadyChange={setAllFormsReady}
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
					{hasPreviewContent &&
						store.state.currentStep >= 1 &&
						!isCertificateStep && (
							<FormPreviewToggle
								activeView={store.state.showPreview ? "preview" : "form"}
								onToggle={handleToggle}
							/>
						)}
				</div>

				<WizardStepper
					currentStep={store.state.currentStep}
					stepStates={stepStates}
					stepValidities={stepValidities}
					onStepClick={handleStepClick}
					stepDescriptions={stepDescriptions}
					stepLabels={stepLabels}
				/>

				{store.state.currentStep >= 1 && (
					<FormsNavigator
						caseId={caseId}
						activeFormId={activeFormId}
						onFormSelect={onFormSelect ?? (() => {})}
						onAddForm={
							store.state.currentStep === 1
								? (onAddForm ?? (() => {}))
								: undefined
						}
						onDeleteForm={
							store.state.currentStep === 1 ? onDeleteForm : undefined
						}
					/>
				)}

				<div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto">
					<WizardLayout
						formPanel={renderStepContent()}
						previewPanel={
							hasPreviewContent ? (
								isCertificateStep ? (
									renderStepContent()
								) : (
									<WizardPreviewPanel caseData={caseData} />
								)
							) : null
						}
						showPreview={hasPreviewContent && store.state.showPreview}
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
					canContinue={
						store.state.currentStep === 2
							? allFormsReady
							: store.state.currentStep !== 1 ||
								(!!forms && forms.length > 0 && allFormsHaveBags)
					}
					lockActions={lockForNonAdmin}
					lockMessage={COMPLETE_LOCK_MESSAGE}
					discardLabel="Back to Cases"
					discardModalTitle="Leave this form?"
					discardModalDescription="Any unsaved progress will be lost. You can return to this form from the case's forms list."
				/>
			</div>
		);
	}
);
