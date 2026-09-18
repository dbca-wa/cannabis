import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { makeObservable, action, computed } from "mobx";
import { logger } from "@/shared/services/logger.service";

/**
 * UI-only state for the case creation form.
 *
 * Case field values live in the CaseFormStore; this tracks only the
 * presentation concerns the form itself cannot derive: whether a submission is
 * in flight, whether the operator has acknowledged an unknown defendant, and
 * whether the entered police reference collides with an existing case.
 */
export interface CaseCreationFormStoreState extends BaseStoreState {
	/** Creation request in progress */
	isSubmitting: boolean;
	/** Operator has explicitly acknowledged the case has no known defendant */
	defendantUnknownAcknowledged: boolean;
	/**
	 * The id of an existing case the entered police reference currently matches,
	 * or null when the reference is unused. While set, creation is blocked and
	 * the operator is steered into that case's add-form flow; correcting the
	 * reference to an unused value clears it.
	 */
	matchedExistingCaseId: number | null;
}

const INITIAL_STATE: CaseCreationFormStoreState = {
	loading: false,
	error: null,
	initialised: false,
	isSubmitting: false,
	defendantUnknownAcknowledged: false,
	matchedExistingCaseId: null,
};

/**
 * Manages presentation state for the case creation form.
 */
export class CaseCreationFormStore extends BaseStore<CaseCreationFormStoreState> {
	constructor() {
		super({ ...INITIAL_STATE });

		makeObservable(this, {
			setSubmitting: action,
			setDefendantUnknownAcknowledged: action,
			setMatchedExistingCaseId: action,
			reset: action,
			hasMatchedExistingCase: computed,
		});
	}

	setSubmitting = (isSubmitting: boolean) => {
		this.state.isSubmitting = isSubmitting;
	};

	/**
	 * Record whether the operator has acknowledged that the case has no known
	 * defendant. When true, the defendants section is valid with zero
	 * defendants and the certificate renders "Unknown".
	 */
	setDefendantUnknownAcknowledged = (acknowledged: boolean) => {
		this.state.defendantUnknownAcknowledged = acknowledged;
	};

	/**
	 * Record the existing case the entered police reference currently matches,
	 * or null when the reference is unused.
	 */
	setMatchedExistingCaseId = (caseId: number | null) => {
		this.state.matchedExistingCaseId = caseId;
	};

	/**
	 * Whether the entered police reference matches an existing case. While true,
	 * creation is blocked.
	 */
	get hasMatchedExistingCase(): boolean {
		return this.state.matchedExistingCaseId !== null;
	}

	reset() {
		this.state.isSubmitting = false;
		this.state.defendantUnknownAcknowledged = false;
		this.state.matchedExistingCaseId = null;
		this.state.loading = false;
		this.state.error = null;
		this.state.initialised = false;

		logger.info("CaseCreationFormStore reset");
	}
}
