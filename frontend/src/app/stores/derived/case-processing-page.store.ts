import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { makeObservable, action } from "mobx";
import { logger } from "@/shared/services/logger.service";
import type { CaseSectionId } from "@/features/cases/utils/caseSections";

/**
 * UI-only state for the case processing page.
 *
 * Every section is rendered at once, so there is no step navigation, no forward
 * gate and no notion of a step being "reached". What remains is which section
 * the reader has jumped to, whether the certificate preview is showing on
 * narrower screens, and whether a finalise request is in flight.
 *
 * Case data itself is owned by TanStack Query.
 */
export interface CaseProcessingPageStoreState extends BaseStoreState {
	/** Section the user last jumped to, or null when following their own scroll. */
	requestedSection: CaseSectionId | null;
	/** Toggle state for form/preview on sub-1920px screens. */
	showPreview: boolean;
	/** Finalise in progress. */
	isSubmitting: boolean;
}

const INITIAL_STATE: CaseProcessingPageStoreState = {
	loading: false,
	error: null,
	initialised: false,
	requestedSection: null,
	showPreview: false,
	isSubmitting: false,
};

/**
 * Manages presentation state for the case processing page.
 */
export class CaseProcessingPageStore extends BaseStore<CaseProcessingPageStoreState> {
	constructor() {
		super({ ...INITIAL_STATE });

		makeObservable(this, {
			requestSection: action,
			clearRequestedSection: action,
			togglePreview: action,
			setShowPreview: action,
			setSubmitting: action,
			reset: action,
		});
	}

	/**
	 * Record that the user asked to view a section. The page consumes this to
	 * scroll, then clears it so a later scroll by hand is not overridden.
	 */
	requestSection = (sectionId: CaseSectionId) => {
		this.state.requestedSection = sectionId;
	};

	clearRequestedSection = () => {
		this.state.requestedSection = null;
	};

	togglePreview = () => {
		this.state.showPreview = !this.state.showPreview;
	};

	setShowPreview = (show: boolean) => {
		this.state.showPreview = show;
	};

	setSubmitting = (isSubmitting: boolean) => {
		this.state.isSubmitting = isSubmitting;
	};

	reset() {
		this.state.requestedSection = null;
		this.state.showPreview = false;
		this.state.isSubmitting = false;
		this.state.loading = false;
		this.state.error = null;
		this.state.initialised = false;

		logger.info("CaseProcessingPageStore reset");
	}
}
