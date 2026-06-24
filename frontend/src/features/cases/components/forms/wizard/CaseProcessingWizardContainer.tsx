import { useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useCaseProcessingWizardStore } from "@/app/providers/store.provider";
import {
	CASE_PROCESSING_STEPS,
	type StepState,
} from "@/app/stores/derived/case-processing-wizard.store";
import { FormPreviewToggle } from "./FormPreviewToggle";
import { WizardStepper } from "./WizardStepper";
import { WizardLayout } from "./WizardLayout";
import { WizardPreviewPanel } from "./WizardPreviewPanel";
import { WizardNavigation } from "./WizardNavigation";
import { CaseCreationSummaryStep } from "./steps/CaseCreationSummaryStep";
import { AssessmentStep } from "./steps/AssessmentStep";
import { UnsignedCertificateStep } from "./steps/UnsignedCertificateStep";
import { BotanistSignOffStep } from "./steps/BotanistSignOffStep";
import { InvoiceStep } from "./steps/InvoiceStep";
import { useSendBack } from "@/features/cases/hooks/useCases";
import { useUnlockCertificate } from "@/features/signatures/hooks";
import type { CasePhase } from "@/features/cases/types/cases.types";

interface CaseProcessingWizardContainerProps {
	/** Case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Callback to persist field changes via mutation */
	onFieldChange: (field: string, value: unknown) => void;
	/** Callback to trigger a workflow action (generate_certificate, sign_certificate, etc.) */
	onAction: (action: string) => void;
	/** Callback to finalise and submit the case */
	onSubmit: () => void;
	/** Callback to discard the draft case */
	onDiscard: () => void;
}

/** Action keys for each step that trigger server-side workflow operations */
const STEP_ACTIONS: Record<number, string> = {
	0: "advance_phase",
	1: "advance_phase",
	2: "advance_phase",
	4: "advance_phase",
	5: "send_documents",
};

/** For advance_phase steps, only fire if the case is still in the expected phase */
const STEP_EXPECTED_PHASE: Record<number, string> = {
	0: "case_creation",
	1: "assessment",
	2: "unsigned_generation",
	4: "invoicing",
};

/**
 * Orchestrator for Process 2 — the case processing wizard.
 * A 6-step wizard with live certificate preview for processing
 * cases through to completion.
 *
 * Steps:
 * 0 - Case Creation (pre-completed, editable summary)
 * 1 - Assessment (drug bags and botanical notes)
 * 2 - Unsigned Certificate (generate PDF)
 * 3 - Botanist Sign-Off (sign certificate)
 * 4 - Invoicing (generate invoice PDF)
 * 5 - Email (send documents)
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

		// ============================================================================
		// Step Validation (computed from caseData)
		// ============================================================================

		/** Step 0: case_number + received + defendants + officers */
		const isStep0Valid = !!(
			caseData &&
			(caseData.case_number as string)?.trim() &&
			(caseData.received as string)?.trim() &&
			Array.isArray(caseData.defendants) &&
			(caseData.defendants as unknown[]).length > 0 &&
			caseData.requesting_officer_id &&
			caseData.submitting_officer_id
		);

		/** Step 1: approved botanist set, at least one bag with non-pending determination, additional_notes min 4 chars */
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

		/** Steps 2-5: based on presence of generated documents */
		const isStep2Valid = !!(
			caseData &&
			Array.isArray(caseData.certificates) &&
			(caseData.certificates as Array<{ unsigned_pdf_file?: string | null }>)
				.length > 0 &&
			!!(
				caseData.certificates as Array<{ unsigned_pdf_file?: string | null }>
			)[0]?.unsigned_pdf_file
		);
		const isStep3Valid = !!(
			caseData &&
			Array.isArray(caseData.certificates) &&
			(caseData.certificates as Array<{ is_locked?: boolean }>).length > 0 &&
			!!(caseData.certificates as Array<{ is_locked?: boolean }>)[0]?.is_locked
		);
		const isStep4Valid = !!(
			caseData &&
			Array.isArray(caseData.invoices) &&
			(caseData.invoices as Array<{ pdf_file?: string | null }>).length > 0 &&
			!!(caseData.invoices as Array<{ pdf_file?: string | null }>)[0]?.pdf_file
		);
		const isStep5Valid = !!caseData?.documents_sent;

		// Phase-aware override: if the backend phase is past a step, that step is valid
		// regardless of whether its artefacts are currently present. This prevents
		// getting stuck on earlier steps when navigating back through a case.
		const PHASE_ORDER = [
			"case_creation",
			"assessment",
			"unsigned_generation",
			"botanist_signoff",
			"invoicing",
			"send_emails",
			"complete",
		];
		const currentPhaseIndex = PHASE_ORDER.indexOf(caseData?.phase as string);

		// A step is considered "past" if the case phase is beyond the phase that step corresponds to
		const isPastStep = (stepPhaseIndex: number) =>
			currentPhaseIndex > stepPhaseIndex;

		const stepValidities = [
			isStep0Valid || isPastStep(0),
			isStep1Valid || isPastStep(1),
			isStep2Valid || isPastStep(2),
			isStep3Valid || isPastStep(3),
			isStep4Valid || isPastStep(4),
			isStep5Valid || isPastStep(5),
		];

		// Derive visual state for each step
		const stepStates: StepState[] = CASE_PROCESSING_STEPS.map((_, index) =>
			store.getStepState(index, stepValidities[index])
		);

		const stepDescriptions = CASE_PROCESSING_STEPS.map(
			(step) => step.description
		);
		const stepLabels = CASE_PROCESSING_STEPS.map((step) => step.label);

		// Check if forward navigation is blocked by an earlier invalid step
		const blockingStepIndex = store.getBlockingStepIndex(stepValidities);
		const isForwardBlocked = blockingStepIndex !== -1;

		// ============================================================================
		// Initialize store from data on first load
		// ============================================================================

		useEffect(() => {
			if (caseData && !store.state.initialised) {
				store.initializeFromValidities(stepValidities);
			}
		}, [caseData, store, stepValidities]);

		// ============================================================================
		// Auto-scroll to top on step change
		// ============================================================================

		useEffect(() => {
			contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}, [store.state.currentStep]);

		// ============================================================================
		// Navigation Handlers
		// ============================================================================

		const scrollToTop = useCallback(() => {
			contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}, []);

		/**
		 * Continue: validate → mark completed → trigger action (phase-aware) → advance.
		 */
		const handleContinue = useCallback(() => {
			const current = store.state.currentStep;
			store.markStepTouched(current);

			// If forward navigation is blocked by an earlier invalid step, go there
			if (isForwardBlocked) {
				store.goToStep(blockingStepIndex);
				scrollToTop();
				return;
			}

			if (stepValidities[current]) {
				// Trigger the associated workflow action before advancing
				const action = STEP_ACTIONS[current];
				if (action) {
					if (action === "advance_phase") {
						// Only advance if the case is still in the expected phase for this step
						const expectedPhase = STEP_EXPECTED_PHASE[current];
						if (caseData?.phase === expectedPhase) {
							onAction(action);
						}
					} else {
						onAction(action);
					}
				}

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
			onAction,
			caseData,
		]);

		/**
		 * Back: navigate to previous step.
		 */
		const handleBack = useCallback(() => {
			store.previousStep();
			scrollToTop();
		}, [store, scrollToTop]);

		/**
		 * Finalise: validate all steps → navigate to first invalid → else submit.
		 */
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

		/**
		 * Handle Continue or Finalise based on position.
		 */
		const handleContinueOrFinalise = useCallback(() => {
			if (store.isLastStep) {
				handleFinalise();
			} else {
				handleContinue();
			}
		}, [store.isLastStep, handleContinue, handleFinalise]);

		/**
		 * Handle step click from stepper.
		 */
		const handleStepClick = useCallback(
			(stepIndex: number) => {
				store.goToStep(stepIndex);
				scrollToTop();
			},
			[store, scrollToTop]
		);

		/**
		 * Handle form/preview toggle.
		 */
		const handleToggle = useCallback(
			(view: "form" | "preview") => {
				store.setShowPreview(view === "preview");
			},
			[store]
		);

		// ============================================================================
		// Send Back
		// ============================================================================

		const sendBackMutation = useSendBack();
		const unlockCertificateMutation = useUnlockCertificate();

		const handleSendBack = useCallback(
			async (targetPhase: CasePhase, reason: string) => {
				const caseId = (caseData?.id as number) ?? 0;
				await sendBackMutation.mutateAsync({
					submissionId: caseId,
					targetPhase,
					reason,
				});

				// Auto-unlock certificate when sending back to unsigned_generation
				if (targetPhase === "unsigned_generation") {
					const certificates = Array.isArray(caseData?.certificates)
						? (caseData.certificates as Array<{
								id: number;
								is_locked?: boolean;
							}>)
						: [];
					const lockedCert = certificates.find((c) => c.is_locked);
					if (lockedCert) {
						await unlockCertificateMutation.mutateAsync({
							submissionId: caseId,
							certificateId: lockedCert.id,
						});
					}
				}

				// Navigate wizard to the target step and clear completed status for steps at/after target
				const targetStepIndex = PHASE_ORDER.indexOf(targetPhase);
				if (targetStepIndex >= 0) {
					// Remove completed status for the target step and all steps after it
					for (let i = targetStepIndex; i < CASE_PROCESSING_STEPS.length; i++) {
						store.state.completedSteps.delete(i);
					}
					// Lower highestStepReached so future steps appear as "future" not "inProgress"
					store.state.highestStepReached = targetStepIndex;
					// Directly set the current step
					store.state.currentStep = targetStepIndex;
				}
				scrollToTop();
			},
			[
				sendBackMutation,
				unlockCertificateMutation,
				caseData,
				store,
				scrollToTop,
			]
		);

		// ============================================================================
		// Step Content Rendering
		// ============================================================================

		const renderStepContent = () => {
			const isTouched = store.state.touchedSteps.has(store.state.currentStep);

			switch (store.state.currentStep) {
				case 0:
					return (
						<CaseCreationSummaryStep
							caseData={caseData}
							isTouched={isTouched}
							onFieldChange={onFieldChange}
						/>
					);
				case 1:
					return (
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
						/>
					);
				case 3:
					return (
						<BotanistSignOffStep
							caseData={caseData}
							caseId={(caseData?.id as number) ?? 0}
							onAction={onAction}
						/>
					);
				case 4:
					return (
						<InvoiceStep
							caseData={caseData}
							caseId={(caseData?.id as number) ?? 0}
							onAction={onAction}
						/>
					);
				case 5:
					return (
						<div className="p-6 text-center text-muted-foreground">
							<p className="text-lg font-medium">
								{CASE_PROCESSING_STEPS[store.state.currentStep].label}
							</p>
							<p className="text-sm mt-2">
								{CASE_PROCESSING_STEPS[store.state.currentStep].description}
							</p>
						</div>
					);
				default:
					return null;
			}
		};

		// ============================================================================
		// Render
		// ============================================================================

		return (
			<div className="flex flex-col gap-6 h-full">
				{/* Header: Title + FormPreviewToggle */}
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tight">Process Case</h1>
					{store.state.currentStep !== 2 &&
						store.state.currentStep !== 3 &&
						store.state.currentStep !== 4 && (
							<FormPreviewToggle
								activeView={store.state.showPreview ? "preview" : "form"}
								onToggle={handleToggle}
							/>
						)}
				</div>

				{/* Stepper */}
				<WizardStepper
					currentStep={store.state.currentStep}
					stepStates={stepStates}
					onStepClick={handleStepClick}
					stepDescriptions={stepDescriptions}
					stepLabels={stepLabels}
				/>

				{/* Main content area with scroll container */}
				<div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto">
					<WizardLayout
						formPanel={renderStepContent()}
						previewPanel={
							store.state.currentStep === 2 ||
							store.state.currentStep === 3 ||
							store.state.currentStep === 4 ? (
								renderStepContent()
							) : (
								<WizardPreviewPanel caseData={caseData} />
							)
						}
						showPreview={store.state.showPreview}
						fullWidthPreview={
							store.state.currentStep === 2 ||
							store.state.currentStep === 3 ||
							store.state.currentStep === 4
						}
					/>
				</div>

				{/* Navigation */}
				<WizardNavigation
					currentStep={store.state.currentStep}
					isLastStep={store.isLastStep}
					isSubmitting={store.state.isSubmitting}
					onBack={handleBack}
					onContinue={handleContinueOrFinalise}
					onDiscard={onDiscard}
					discardLabel="Delete Case"
					discardModalTitle="Delete this case?"
					discardModalDescription="This will permanently delete the case and all associated drug bags, certificates, and invoices. Defendants, officers, and users will not be affected. This action cannot be undone."
					casePhase={caseData?.phase as CasePhase | undefined}
					onSendBack={handleSendBack}
					isSendingBack={sendBackMutation.isPending}
				/>
			</div>
		);
	}
);
