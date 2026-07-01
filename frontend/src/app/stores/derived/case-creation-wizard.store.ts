import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { makeObservable, action, computed } from "mobx";
import { logger } from "@/shared/services/logger.service";
import type { StepState } from "./case-processing-wizard.store";

/**
 * Step definitions for the 3-step case creation wizard (Process 1).
 */
export const CASE_CREATION_STEPS = [
	{ label: "Case Details", description: "Case number, date received, type" },
	{ label: "Defendants", description: "Add and manage defendants" },
	{ label: "Officers", description: "Requesting and submitting officers" },
] as const;

export const CASE_CREATION_TOTAL_STEPS = CASE_CREATION_STEPS.length;

/**
 * UI-only state for the case creation wizard (Process 1).
 * Does NOT hold form data — that comes from TanStack Query cache.
 */
export interface CaseCreationWizardStoreState extends BaseStoreState {
	/** 0-indexed active step */
	currentStep: number;
	/** Steps the user has successfully advanced past */
	completedSteps: Set<number>;
	/** Steps where validation errors should be displayed */
	touchedSteps: Set<number>;
	/** Final submission in progress */
	isSubmitting: boolean;
	/** User has explicitly acknowledged the case has no known defendant */
	defendantUnknownAcknowledged: boolean;
}

const INITIAL_STATE: CaseCreationWizardStoreState = {
	loading: false,
	error: null,
	initialised: false,
	currentStep: 0,
	completedSteps: new Set<number>(),
	touchedSteps: new Set<number>(),
	isSubmitting: false,
	defendantUnknownAcknowledged: false,
};

/**
 * Manages UI state for the case creation wizard (Process 1):
 * step navigation, validation display, and submission state.
 * Form data is owned by TanStack Query — this store only tracks
 * navigation and display concerns.
 *
 * 3 steps: Case Details → Defendants → Officers
 */
export class CaseCreationWizardStore extends BaseStore<CaseCreationWizardStoreState> {
	/**
	 * External validation function provided by the consuming component.
	 * Returns true if the current step's form data is valid.
	 */
	private stepValidationFn: ((stepIndex: number) => boolean) | null = null;

	constructor() {
		super({
			...INITIAL_STATE,
			completedSteps: new Set(),
			touchedSteps: new Set(),
		});

		makeObservable(this, {
			// Navigation actions
			nextStep: action,
			previousStep: action,
			goToStep: action,

			// UI actions
			markStepTouched: action,
			markStepCompleted: action,
			setSubmitting: action,
			setStepValidationFn: action,
			setDefendantUnknownAcknowledged: action,

			// Reset
			reset: action,

			// Computed properties
			canGoBack: computed,
			canGoForward: computed,
			isLastStep: computed,
		});
	}

	// ============================================================================
	// Configuration
	// ============================================================================

	/**
	 * Set the external validation function. Components call this to provide
	 * step-level validation that gates forward navigation.
	 */
	setStepValidationFn = (fn: (stepIndex: number) => boolean) => {
		this.stepValidationFn = fn;
	};

	// ============================================================================
	// Navigation Actions
	// ============================================================================

	/**
	 * Advance to the next step. Marks current step as touched and completed.
	 */
	nextStep = () => {
		if (this.state.currentStep >= CASE_CREATION_TOTAL_STEPS - 1) {
			logger.warn("Cannot advance past last step");
			return;
		}

		this.state.touchedSteps.add(this.state.currentStep);

		if (!this.canGoForward) {
			logger.warn("Cannot advance — current step is invalid");
			return;
		}

		this.state.completedSteps.add(this.state.currentStep);
		this.state.currentStep += 1;

		logger.debug("CaseCreationWizard advanced to step", {
			currentStep: this.state.currentStep,
		});
	};

	/**
	 * Navigate to the previous step.
	 */
	previousStep = () => {
		if (this.state.currentStep <= 0) {
			logger.warn("Cannot go before first step");
			return;
		}

		this.state.currentStep -= 1;

		logger.debug("CaseCreationWizard navigated back to step", {
			currentStep: this.state.currentStep,
		});
	};

	/**
	 * Navigate to a specific step index. Only allows navigation to
	 * completed steps or the current step.
	 */
	goToStep = (stepIndex: number) => {
		if (stepIndex < 0 || stepIndex >= CASE_CREATION_TOTAL_STEPS) {
			logger.warn("Invalid step index", { stepIndex });
			return;
		}

		// Allow navigating back to any step at or before current,
		// or to the next step if current is completed
		if (
			stepIndex <= this.state.currentStep ||
			this.state.completedSteps.has(stepIndex - 1)
		) {
			this.state.currentStep = stepIndex;
			logger.debug("CaseCreationWizard navigated to step", { stepIndex });
		} else {
			logger.warn("Cannot navigate to incomplete step", { stepIndex });
		}
	};

	// ============================================================================
	// UI Actions
	// ============================================================================

	/**
	 * Mark a step as touched — triggers validation error display for that step.
	 */
	markStepTouched = (stepIndex: number) => {
		this.state.touchedSteps.add(stepIndex);
	};

	/**
	 * Mark a step as completed (passed validation successfully).
	 */
	markStepCompleted = (stepIndex: number) => {
		this.state.completedSteps.add(stepIndex);
	};

	/**
	 * Set the submitting state during final case creation.
	 */
	setSubmitting = (isSubmitting: boolean) => {
		this.state.isSubmitting = isSubmitting;
	};

	/**
	 * Record whether the user has explicitly acknowledged that the case has no
	 * known defendant. When true, the defendants step is considered valid with
	 * zero defendants and the certificate renders "Unknown".
	 */
	setDefendantUnknownAcknowledged = (acknowledged: boolean) => {
		this.state.defendantUnknownAcknowledged = acknowledged;
	};

	// ============================================================================
	// Computed Properties
	// ============================================================================

	/**
	 * Whether the user can navigate backwards.
	 */
	get canGoBack(): boolean {
		return this.state.currentStep > 0;
	}

	/**
	 * Whether the user can navigate forward.
	 * Gated by external validation — if no validation function is set,
	 * defaults to allowing forward navigation.
	 */
	get canGoForward(): boolean {
		if (this.state.currentStep >= CASE_CREATION_TOTAL_STEPS - 1) {
			return false;
		}

		if (this.stepValidationFn) {
			return this.stepValidationFn(this.state.currentStep);
		}

		return true;
	}

	/**
	 * Whether the user is on the final step.
	 */
	get isLastStep(): boolean {
		return this.state.currentStep === CASE_CREATION_TOTAL_STEPS - 1;
	}

	// ============================================================================
	// Step State Derivation
	// ============================================================================

	/**
	 * Derives the visual state of a step based on navigation state and validity.
	 * Called by the stepper component with external validation data.
	 *
	 * @param index - The step index to evaluate
	 * @param isStepValid - Whether the step's form data is currently valid
	 */
	getStepState(index: number, isStepValid: boolean): StepState {
		if (index === this.state.currentStep) {
			return "active";
		}

		if (this.state.completedSteps.has(index)) {
			return isStepValid ? "completed" : "invalid";
		}

		if (index < this.state.currentStep) {
			return "inProgress";
		}

		return "future";
	}

	// ============================================================================
	// Reset
	// ============================================================================

	/**
	 * Reset the wizard store to its initial state.
	 */
	reset() {
		this.state.currentStep = 0;
		this.state.completedSteps.clear();
		this.state.touchedSteps.clear();
		this.state.isSubmitting = false;
		this.state.defendantUnknownAcknowledged = false;
		this.state.loading = false;
		this.state.error = null;
		this.state.initialised = false;
		this.stepValidationFn = null;

		logger.info("CaseCreationWizardStore reset");
	}
}
