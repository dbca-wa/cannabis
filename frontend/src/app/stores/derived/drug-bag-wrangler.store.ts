/**
 * DrugBagWranglerStore — MobX store for managing in-memory drug bag state,
 * client-side validation, and certificate preview preferences.
 *
 * Handles the full lifecycle of bags before they hit the server:
 * add → edit → validate → persist (or reject with errors).
 */

import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { makeObservable, action, computed } from "mobx";
import { logger } from "@/shared/services/logger.service";
import type {
	DrugBagContentType,
	BotanicalDetermination,
} from "@/features/cases/types/drugBags.types";

export interface InMemoryBag {
	tempId: string;
	seal_tag_numbers: string;
	new_seal_tag_numbers: string;
	content_type: DrugBagContentType;
	determination: BotanicalDetermination;
}

export interface BagValidationError {
	tempId: string;
	field: string;
	message: string;
}

interface DrugBagWranglerStoreState extends BaseStoreState {
	/** In-memory bags not yet persisted to the server */
	bags: InMemoryBag[];
	/** Validation errors keyed by tempId + field */
	validationErrors: BagValidationError[];
	/** Whether a "Save Changes" operation is in progress */
	isSaving: boolean;
}

const INITIAL_STATE: DrugBagWranglerStoreState = {
	loading: false,
	error: null,
	initialised: false,
	bags: [],
	validationErrors: [],
	isSaving: false,
};

export class DrugBagWranglerStore extends BaseStore<DrugBagWranglerStoreState> {
	/** Per-form stash of unsaved bags, keyed by formId */
	private formBagStash = new Map<number, InMemoryBag[]>();

	constructor() {
		super({ ...INITIAL_STATE });

		makeObservable(this, {
			// Bag actions
			addBag: action,
			addBags: action,
			updateBag: action,
			removeBag: action,
			clearBags: action,

			// Per-form stash actions
			stashForForm: action,
			restoreForForm: action,
			clearStashForForm: action,

			// Validation
			validate: action,
			clearValidationErrors: action,
			setValidationErrors: action,

			// Saving state
			setSaving: action,

			// Reset
			reset: action,

			// Computed
			bagCount: computed,
			hasErrors: computed,
			isValid: computed,
			errorsForBag: computed,
		});
	}

	// ============================================================================
	// Bag Management
	// ============================================================================

	/** Add a single empty bag (no auto-generated tag) */
	addBag = () => {
		this.state.bags.push({
			tempId: crypto.randomUUID(),
			seal_tag_numbers: "",
			new_seal_tag_numbers: "",
			content_type: "plant",
			// Most cases are cannabis sativa — default to it to speed up entry.
			determination: "cannabis_sativa",
		});
		logger.debug("DrugBagWrangler: added empty bag", {
			count: this.state.bags.length,
		});
	};

	/** Add multiple bags at once (from bulk modal) */
	addBags = (bags: Omit<InMemoryBag, "tempId">[]) => {
		const newBags: InMemoryBag[] = bags.map((b) => ({
			...b,
			tempId: crypto.randomUUID(),
		}));
		this.state.bags.push(...newBags);
		logger.debug("DrugBagWrangler: added multiple bags", {
			added: newBags.length,
			total: this.state.bags.length,
		});
	};

	/** Update a specific field on an in-memory bag */
	updateBag = (
		tempId: string,
		field: keyof Omit<InMemoryBag, "tempId">,
		value: string
	) => {
		const bag = this.state.bags.find((b) => b.tempId === tempId);
		if (bag) {
			(bag[field] as string) = value;
			// Clear validation errors for this field
			this.state.validationErrors = this.state.validationErrors.filter(
				(e) => !(e.tempId === tempId && e.field === field)
			);
		}
	};

	/** Remove a bag by tempId */
	removeBag = (tempId: string) => {
		this.state.bags = this.state.bags.filter((b) => b.tempId !== tempId);
		this.state.validationErrors = this.state.validationErrors.filter(
			(e) => e.tempId !== tempId
		);
		logger.debug("DrugBagWrangler: removed bag", {
			tempId,
			remaining: this.state.bags.length,
		});
	};

	/** Clear all in-memory bags (after successful persist) */
	clearBags = (formId?: number) => {
		this.state.bags = [];
		this.state.validationErrors = [];
		if (formId) this.formBagStash.delete(formId);
	};

	/** Stash the current bags for a form (called before switching away) */
	stashForForm = (formId: number) => {
		if (formId && this.state.bags.length > 0) {
			this.formBagStash.set(formId, [...this.state.bags]);
		} else if (formId) {
			this.formBagStash.delete(formId);
		}
	};

	/** Restore bags from the stash for a form (called when switching to it) */
	restoreForForm = (formId: number) => {
		const stashed = this.formBagStash.get(formId);
		this.state.bags = stashed ? [...stashed] : [];
		this.state.validationErrors = [];
	};

	/** Clear the stash for a specific form (called after successful save) */
	clearStashForForm = (formId: number) => {
		this.formBagStash.delete(formId);
	};

	// ============================================================================
	// Validation
	// ============================================================================

	/**
	 * Validate all in-memory bags against rules:
	 * - No empty original tag
	 * - Content type must be set (not empty)
	 * - Determination must be set (not "pending")
	 *
	 * Seal tags have no uniqueness constraint — they may repeat freely.
	 *
	 * @param _serverTags - unused, kept for API compatibility
	 * @returns true if all bags are valid
	 */
	validate = (_serverTags: string[]): boolean => {
		const errors: BagValidationError[] = [];

		for (const bag of this.state.bags) {
			const orig = bag.seal_tag_numbers.trim();

			// Original tag — required.
			if (!orig) {
				errors.push({
					tempId: bag.tempId,
					field: "seal_tag_numbers",
					message: "Original tag is required",
				});
			}

			// Content type must be set (shouldn't happen with select, but safety).
			if (!bag.content_type) {
				errors.push({
					tempId: bag.tempId,
					field: "content_type",
					message: "Content type is required",
				});
			}

			// Determination must be a real value (not the pending placeholder).
			if (!bag.determination || bag.determination === "pending") {
				errors.push({
					tempId: bag.tempId,
					field: "determination",
					message: "Assessment determination is required",
				});
			}
		}

		this.state.validationErrors = errors;
		return errors.length === 0;
	};

	clearValidationErrors = () => {
		this.state.validationErrors = [];
	};

	/** Replace the validation errors wholesale (used to surface server-side
	 * batch errors against the matching bags). */
	setValidationErrors = (errors: BagValidationError[]) => {
		this.state.validationErrors = errors;
	};

	// ============================================================================
	// Saving State
	// ============================================================================

	setSaving = (isSaving: boolean) => {
		this.state.isSaving = isSaving;
	};

	// ============================================================================
	// Computed
	// ============================================================================

	get bagCount() {
		return this.state.bags.length;
	}

	get hasErrors() {
		return this.state.validationErrors.length > 0;
	}

	get isValid() {
		return (
			this.state.bags.length > 0 && this.state.validationErrors.length === 0
		);
	}

	/** Get errors grouped by bag tempId */
	get errorsForBag() {
		const map = new Map<string, BagValidationError[]>();
		for (const err of this.state.validationErrors) {
			const existing = map.get(err.tempId) ?? [];
			existing.push(err);
			map.set(err.tempId, existing);
		}
		return map;
	}

	// ============================================================================
	// Reset
	// ============================================================================

	reset() {
		this.state.bags = [];
		this.state.validationErrors = [];
		this.state.isSaving = false;
		this.state.loading = false;
		this.state.error = null;
		this.state.initialised = false;
		this.formBagStash.clear();
		logger.info("DrugBagWranglerStore reset");
	}
}
