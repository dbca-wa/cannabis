import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { makeObservable, action, computed } from "mobx";
import { logger } from "@/shared/services/logger.service";

/**
 * Visual state of a wizard step indicator.
 */
export type StepState =
	"active" | "completed" | "invalid" | "inProgress" | "future";

/**
 * Step definition for the case processing wizard (Process 2).
 */
export interface CaseProcessingStep {
	readonly label: string;
	readonly description: string;
	readonly phase: string;
}

/**
 * Step definitions for the case processing wizard.
 * Three steps up to certificate generation; batching and completion happen
 * from the Cases and Batches pages, not in this wizard.
 */
export const CASE_PROCESSING_STEPS: readonly CaseProcessingStep[] = [
	{
		label: "Case Details",
		description: "Case details",
		phase: "details",
	},
	{
		label: "Assessment",
		description: "Forms & Drug Bags",
		phase: "assessment",
	},
	{
		label: "Certificates",
		description: "Generate Certificates",
		phase: "unsigned_generation",
	},
] as const;

export const TOTAL_STEPS = CASE_PROCESSING_STEPS.length;

/**
 * UI-only state for the case processing wizard (Process 2).
 * Does NOT hold form data — that comes from TanStack Query cache.
 */
export interface CaseProcessingWizardStoreState extends BaseStoreState {
	/** 0-indexed active step */
	currentStep: number;
	/** Steps the user has successfully advanced past */
	completedSteps: Set<number>;
	/** Steps where validation errors should be displayed */
	touchedSteps: Set<number>;
	/** The highest step index ever set as currentStep */
	highestStepReached: number;
	/** Toggle state for form/preview on sub-1920px screens */
	showPreview: boolean;
	/** Final submission in progress */
	isSubmitting: boolean;
	/** Step 0 is auto-completed when the wizard loads (case already exists from Process 1) */
	step0PreCompleted: boolean;
}

const INITIAL_STATE: CaseProcessingWizardStoreState = {
	loading: false,
	error: null,
	initialised: false,
	currentStep: 0,
	completedSteps: new Set<number>(),
	touchedSteps: new Set<number>(),
	highestStepReached: 0,
	showPreview: false,
	isSubmitting: false,
	step0PreCompleted: true,
};

/**
 * Manages UI state for the case processing wizard (Process 2): step navigation,
 * validation display, preview toggle, and blocking validation.
 *
 * Form data is owned by TanStack Query — this store only tracks navigation/display
 * concerns. Step 0 (Case Details) starts pre-completed since the case already
 * exists from the creation wizard.
 *
 * Blocking validation (SPMS pattern): if step 0 becomes invalid after editing,
 * all subsequent steps are blocked until step 0 is corrected.
 */
export class CaseProcessingWizardStore extends BaseStore<CaseProcessingWizardStoreState> {
	constructor() {
		super({
			...INITIAL_STATE,
			completedSteps: new Set<number>(),
			touchedSteps: new Set<number>(),
		});

		makeObservable(this, {
			// Navigation actions
			nextStep: action,
			previousStep: action,
			goToStep: action,
			initializeFromValidities: action,

			// UI actions
			togglePreview: action,
			setShowPreview: action,
			markStepTouched: action,
			markStepCompleted: action,
			setSubmitting: action,

			// Reset
			reset: action,

			// Computed properties
			canGoBack: computed,
			canGoForward: computed,
			isLastStep: computed,
		});
	}

	// ============================================================================
	// Initialization
	// ============================================================================

	/**
	 * Set the initial active step based on which steps have valid data.
	 * Finds the first step that is NOT valid (the one needing attention)
	 * and lands there. Only valid steps BEFORE the landing step are marked
	 * as completed — the landing step itself stays out of completedSteps so
	 * getStepState returns "active" (not "invalid") while the user is on it.
	 */
	initializeFromValidities = (stepValidities: boolean[]) => {
		this.state.completedSteps.clear();

		// Find the first invalid step — that's where the user lands.
		let firstIncomplete = stepValidities.length;
		for (let i = 0; i < stepValidities.length; i++) {
			if (!stepValidities[i]) {
				firstIncomplete = i;
				break;
			}
		}

		const landingStep = Math.min(firstIncomplete, TOTAL_STEPS - 1);

		// Mark only VALID steps before the landing step as completed.
		// The landing step itself is NOT completed — the user still needs to work on it.
		// This means on a fresh case (landing on step 1), step 1 is NOT in completedSteps,
		// so getStepState returns "active" (not "invalid") and the connector stays grey.
		for (let i = 0; i < landingStep; i++) {
			if (stepValidities[i]) {
				this.state.completedSteps.add(i);
			}
		}

		this.state.currentStep = landingStep;
		this.state.highestStepReached = landingStep;
		this.state.initialised = true;

		logger.debug("Processing wizard initialised from data", {
			currentStep: this.state.currentStep,
			completedSteps: Array.from(this.state.completedSteps),
		});
	};

	// ============================================================================
	// Navigation Actions
	// ============================================================================

	/**
	 * Advance to the next step. Marks current step as completed.
	 */
	nextStep = () => {
		if (this.state.currentStep >= TOTAL_STEPS - 1) {
			logger.warn("Cannot advance past last step");
			return;
		}

		this.state.completedSteps.add(this.state.currentStep);
		this.state.currentStep += 1;
		this.state.highestStepReached = Math.max(
			this.state.highestStepReached,
			this.state.currentStep
		);

		logger.debug("Processing wizard advanced to next step", {
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

		logger.debug("Processing wizard navigated to previous step", {
			currentStep: this.state.currentStep,
		});
	};

	/**
	 * Navigate to a specific step index. Respects blocking validation:
	 * cannot navigate to a step if any prior completed step is invalid.
	 * Allows navigating to any step at or below the highest step ever reached.
	 */
	goToStep = (stepIndex: number) => {
		if (stepIndex < 0 || stepIndex >= TOTAL_STEPS) {
			logger.warn("Invalid step index", { stepIndex });
			return;
		}

		// Allow navigation to any step at or below highest ever reached
		if (stepIndex <= this.state.highestStepReached) {
			this.state.currentStep = stepIndex;
			logger.debug("Processing wizard navigated to step", { stepIndex });
		} else if (this.state.completedSteps.has(stepIndex - 1)) {
			// Also allow going one step past the last completed step
			this.state.currentStep = stepIndex;
			this.state.highestStepReached = Math.max(
				this.state.highestStepReached,
				stepIndex
			);
			logger.debug("Processing wizard navigated to step", { stepIndex });
		} else {
			logger.warn("Cannot navigate to step beyond highest reached", {
				stepIndex,
			});
		}
	};

	// ============================================================================
	// UI Actions
	// ============================================================================

	/**
	 * Toggle preview visibility (for sub-1920px screens).
	 */
	togglePreview = () => {
		this.state.showPreview = !this.state.showPreview;
	};

	/**
	 * Explicitly set preview visibility.
	 */
	setShowPreview = (show: boolean) => {
		this.state.showPreview = show;
	};

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
	 * Set the submitting state during final case submission.
	 */
	setSubmitting = (isSubmitting: boolean) => {
		this.state.isSubmitting = isSubmitting;
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
	 * Whether there is a next step available.
	 */
	get canGoForward(): boolean {
		return this.state.currentStep < TOTAL_STEPS - 1;
	}

	/**
	 * Whether the user is on the final step.
	 */
	get isLastStep(): boolean {
		return this.state.currentStep === TOTAL_STEPS - 1;
	}

	// ============================================================================
	// Step State Derivation + Blocking Validation
	// ============================================================================

	/**
	 * Check whether a step is clickable given the validity of all steps.
	 * Implements the SPMS blocking pattern: if any completed step before the
	 * target step is invalid, the target is blocked.
	 *
	 * @param stepIndex - The step to check
	 * @param stepValidities - Array of booleans for each step's validity
	 */
	isStepClickable(stepIndex: number, stepValidities: boolean[]): boolean {
		// Can always click the current step or go backwards
		if (stepIndex <= this.state.currentStep) {
			return true;
		}

		// Check all completed steps before the target — if any are invalid, block
		for (let i = 0; i < stepIndex; i++) {
			if (this.state.completedSteps.has(i) && !stepValidities[i]) {
				return false;
			}
		}

		// Also require the step before to be completed
		return this.state.completedSteps.has(stepIndex - 1);
	}

	/**
	 * Check whether forward navigation is blocked due to an earlier invalid step.
	 * Returns the index of the first blocking step, or -1 if not blocked.
	 *
	 * @param stepValidities - Array of booleans for each step's validity
	 */
	getBlockingStepIndex(stepValidities: boolean[]): number {
		for (let i = 0; i <= this.state.currentStep; i++) {
			if (this.state.completedSteps.has(i) && !stepValidities[i]) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Derives the visual state of a step based on navigation state and validity.
	 * Called by the stepper component with external validation data.
	 *
	 * Step 0 starts pre-completed. If step 0 becomes invalid, it shows as "invalid"
	 * and all subsequent steps are blocked.
	 *
	 * @param index - The step index to evaluate
	 * @param isStepValid - Whether the step's form data is currently valid
	 */
	getStepState(index: number, isStepValid: boolean): StepState {
		// Current step is always "active"
		if (index === this.state.currentStep) {
			return "active";
		}

		// Completed steps: show green if still valid, red if data became invalid
		if (this.state.completedSteps.has(index)) {
			return isStepValid ? "completed" : "invalid";
		}

		// Steps at or below highest reached show as "inProgress" (navigable)
		if (index <= this.state.highestStepReached) {
			return "inProgress";
		}

		// Steps beyond highest reached are "future" (disabled)
		return "future";
	}

	// ============================================================================
	// Reset
	// ============================================================================

	/**
	 * Reset the wizard store to its initial state.
	 * Step 0 is pre-completed by default (case already exists).
	 */
	reset() {
		this.state.currentStep = 0;
		this.state.completedSteps.clear();
		this.state.touchedSteps.clear();
		this.state.highestStepReached = 0;
		this.state.showPreview = false;
		this.state.isSubmitting = false;
		this.state.step0PreCompleted = true;
		this.state.loading = false;
		this.state.error = null;
		this.state.initialised = false;

		logger.info("CaseProcessingWizardStore reset");
	}
}
