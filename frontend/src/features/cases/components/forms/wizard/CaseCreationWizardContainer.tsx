import { useCallback, useEffect, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useCaseCreationWizardStore } from "@/app/providers/store.provider";
import { CASE_CREATION_STEPS } from "@/app/stores/derived/case-creation-wizard.store";
import type { StepState } from "@/app/stores/derived/case-processing-wizard.store";
import { WizardStepper } from "./WizardStepper";
import { WizardNavigation } from "./WizardNavigation";
import { CaseDetailsStep } from "./steps/CaseDetailsStep";
import { DefendantsStep } from "./steps/DefendantsStep";
import { OfficersStep } from "./steps/OfficersStep";

interface CaseCreationWizardContainerProps {
	/** Case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Callback to persist field changes via mutation */
	onFieldChange: (field: string, value: unknown) => void;
	/** Callback to finalise and submit the case */
	onSubmit: () => void;
	/** Callback to discard the draft case */
	onDiscard: () => void;
}

/**
 * Orchestrator for Process 1 — the case creation wizard.
 * A simple 3-step data-entry wizard with no preview panel.
 * Coordinates MobX UI state (step navigation, validation display) with
 * TanStack Query data passed in via props.
 *
 * Steps: Case Details (0) → Defendants (1) → Officers (2)
 */
export const CaseCreationWizardContainer = observer(
	({
		caseData,
		onFieldChange,
		onSubmit,
		onDiscard,
	}: CaseCreationWizardContainerProps) => {
		const store = useCaseCreationWizardStore();
		const contentRef = useRef<HTMLDivElement>(null);

		// ============================================================================
		// Step Validation (computed from caseData)
		// ============================================================================

		const isStep0Valid = !!(
			caseData &&
			(caseData.case_number as string)?.trim() &&
			(caseData.received as string)?.trim()
		);

		const isStep1Valid = !!(
			caseData &&
			Array.isArray(caseData.defendants) &&
			(caseData.defendants as unknown[]).length > 0
		);

		const isStep2Valid = !!(
			caseData &&
			caseData.requesting_officer_id &&
			caseData.submitting_officer_id &&
			caseData.station_id
		);

		const stepValidities = useMemo(
			() => [isStep0Valid, isStep1Valid, isStep2Valid],
			[isStep0Valid, isStep1Valid, isStep2Valid]
		);

		// Derive visual state for each step
		const stepStates: StepState[] = CASE_CREATION_STEPS.map((_, index) =>
			store.getStepState(index, stepValidities[index])
		);

		const stepDescriptions = CASE_CREATION_STEPS.map(
			(step) => step.description
		);

		const stepLabels = CASE_CREATION_STEPS.map((step) => step.label);

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
		 * Continue: mark step touched → validate → if valid mark completed + advance + scroll to top.
		 */
		const handleContinue = useCallback(() => {
			const current = store.state.currentStep;
			store.markStepTouched(current);

			if (stepValidities[current]) {
				store.markStepCompleted(current);
				store.nextStep();
				scrollToTop();
			}
		}, [store, stepValidities, scrollToTop]);

		/**
		 * Back: navigate to previous step + scroll to top.
		 */
		const handleBack = useCallback(() => {
			store.previousStep();
			scrollToTop();
		}, [store, scrollToTop]);

		/**
		 * Final submit: validate all steps → navigate to first invalid → else call onSubmit.
		 */
		const handleFinalise = useCallback(() => {
			// Mark all steps as touched so errors display
			for (let i = 0; i < CASE_CREATION_STEPS.length; i++) {
				store.markStepTouched(i);
			}

			// Find first invalid step
			const firstInvalidIndex = stepValidities.findIndex((valid) => !valid);

			if (firstInvalidIndex !== -1) {
				store.goToStep(firstInvalidIndex);
				scrollToTop();
				return;
			}

			// All valid — submit
			onSubmit();
		}, [store, stepValidities, scrollToTop, onSubmit]);

		/**
		 * Handle Continue or Finalise based on current step position.
		 */
		const handleContinueOrFinalise = useCallback(() => {
			if (store.isLastStep) {
				handleFinalise();
			} else {
				handleContinue();
			}
		}, [store.isLastStep, handleContinue, handleFinalise]);

		/**
		 * Handle step click from stepper — navigate to the clicked step.
		 */
		const handleStepClick = useCallback(
			(stepIndex: number) => {
				store.goToStep(stepIndex);
				scrollToTop();
			},
			[store, scrollToTop]
		);

		// ============================================================================
		// Step Content Rendering
		// ============================================================================

		const renderStepContent = () => {
			const isTouched = store.state.touchedSteps.has(store.state.currentStep);

			switch (store.state.currentStep) {
				case 0:
					return (
						<CaseDetailsStep
							caseData={caseData}
							isTouched={isTouched}
							onFieldChange={onFieldChange}
						/>
					);
				case 1:
					return (
						<DefendantsStep
							caseData={caseData}
							isTouched={isTouched}
							onFieldChange={onFieldChange}
						/>
					);
				case 2:
					return (
						<OfficersStep
							caseData={caseData}
							isTouched={isTouched}
							onFieldChange={onFieldChange}
						/>
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
				{/* Header */}
				<h1 className="text-2xl font-bold tracking-tight">Create Case</h1>

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
					{renderStepContent()}
				</div>

				{/* Navigation */}
				<WizardNavigation
					currentStep={store.state.currentStep}
					isLastStep={store.isLastStep}
					isSubmitting={store.state.isSubmitting}
					onBack={handleBack}
					onContinue={handleContinueOrFinalise}
					onDiscard={onDiscard}
				/>
			</div>
		);
	}
);
