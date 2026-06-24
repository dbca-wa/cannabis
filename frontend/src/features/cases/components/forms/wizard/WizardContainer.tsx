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
import { WizardFormPanel } from "./WizardFormPanel";
import { WizardPreviewPanel } from "./WizardPreviewPanel";
import { WizardNavigation } from "./WizardNavigation";

interface WizardContainerProps {
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
 * Orchestrator for the case creation wizard. Coordinates MobX UI state
 * (step navigation, validation display, preview toggle) with TanStack
 * Query data passed in via props.
 */
export const WizardContainer = observer(
	({ caseData, onFieldChange, onSubmit, onDiscard }: WizardContainerProps) => {
		const store = useCaseProcessingWizardStore();
		const contentRef = useRef<HTMLDivElement>(null);

		// ============================================================================
		// Step Validation (computed from case data)
		// ============================================================================

		const isStep0Valid = !!(
			caseData &&
			(caseData.case_number as string)?.trim() &&
			(caseData.received as string)?.trim()
		);

		const isStep1Valid = !!(
			caseData &&
			caseData.requesting_officer_id &&
			caseData.submitting_officer_id &&
			caseData.station_id
		);

		const isStep2Valid = !!(
			caseData &&
			Array.isArray(caseData.bags) &&
			(caseData.bags as unknown[]).length > 0
		);

		const stepValidities = [isStep0Valid, isStep1Valid, isStep2Valid];

		// Derive visual state for each step using store method
		const stepStates: StepState[] = CASE_PROCESSING_STEPS.map((_, index) =>
			store.getStepState(index, stepValidities[index])
		);

		const stepDescriptions = CASE_PROCESSING_STEPS.map(
			(step) => step.description
		);

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
		 * Continue: mark step touched → validate → if valid mark completed + advance.
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
			// Mark all steps as touched so errors display
			for (let i = 0; i < CASE_PROCESSING_STEPS.length; i++) {
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
		 * Handle Continue/Finalise based on whether we're on the last step.
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
		// Render
		// ============================================================================

		const isTouched = store.state.touchedSteps.has(store.state.currentStep);

		return (
			<div className="flex flex-col gap-6 h-full">
				{/* Header: Title + FormPreviewToggle */}
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tight">Create Case</h1>
					<FormPreviewToggle
						activeView={store.state.showPreview ? "preview" : "form"}
						onToggle={handleToggle}
					/>
				</div>

				{/* Stepper */}
				<WizardStepper
					currentStep={store.state.currentStep}
					stepStates={stepStates}
					onStepClick={handleStepClick}
					stepDescriptions={stepDescriptions}
				/>

				{/* Main content area with scroll container */}
				<div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto">
					<WizardLayout
						formPanel={
							<WizardFormPanel
								currentStep={store.state.currentStep}
								caseData={caseData}
								isTouched={isTouched}
								onFieldChange={onFieldChange}
							/>
						}
						previewPanel={<WizardPreviewPanel caseData={caseData} />}
						showPreview={store.state.showPreview}
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
				/>
			</div>
		);
	}
);
