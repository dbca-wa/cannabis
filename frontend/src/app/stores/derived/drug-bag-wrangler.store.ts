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
	constructor() {
		super({ ...INITIAL_STATE });

		makeObservable(this, {
			// Bag actions
			addBag: action,
			addBags: action,
			updateBag: action,
			removeBag: action,
			clearBags: action,

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
	clearBags = () => {
		this.state.bags = [];
		this.state.validationErrors = [];
	};

	// ============================================================================
	// Validation
	// ============================================================================

	/**
	 * Validate all in-memory bags against rules:
	 * - No empty original tag
	 * - No duplicate original tags (within in-memory AND against server tags)
	 * - Original tag !== new tag on same bag
	 * - Content type must be set (not empty)
	 * - Determination must be set (not "pending")
	 *
	 * @param serverTags - existing tag numbers from server-persisted bags
	 * @returns true if all bags are valid
	 */
	validate = (serverTags: string[]): boolean => {
		const errors: BagValidationError[] = [];

		// Build a claimed-tag count across server tags plus every in-memory bag's
		// original and new tag. Original and new tags share one namespace — any
		// value used more than once is a conflict. A bag whose new tag equals its
		// own original is reported separately (so we don't double-count it).
		const counts = new Map<string, number>();
		const bump = (value: string) => {
			const v = (value ?? "").trim();
			if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
		};
		serverTags.forEach((t) => bump(t));
		for (const bag of this.state.bags) {
			const orig = bag.seal_tag_numbers.trim();
			const neu = bag.new_seal_tag_numbers.trim();
			bump(orig);
			if (neu && neu !== orig) bump(neu);
		}

		for (const bag of this.state.bags) {
			const orig = bag.seal_tag_numbers.trim();
			const neu = bag.new_seal_tag_numbers.trim();

			// Original tag — required and unique across the namespace.
			if (!orig) {
				errors.push({
					tempId: bag.tempId,
					field: "seal_tag_numbers",
					message: "Original tag is required",
				});
			} else if ((counts.get(orig) ?? 0) > 1) {
				errors.push({
					tempId: bag.tempId,
					field: "seal_tag_numbers",
					message: "Tag already in use (duplicate or exists on this case)",
				});
			}

			// New tag — optional, but must differ from the original and be unique.
			if (neu) {
				if (neu === orig) {
					errors.push({
						tempId: bag.tempId,
						field: "new_seal_tag_numbers",
						message: "New tag must differ from original",
					});
				} else if ((counts.get(neu) ?? 0) > 1) {
					errors.push({
						tempId: bag.tempId,
						field: "new_seal_tag_numbers",
						message: "Tag already in use (duplicate or exists on this case)",
					});
				}
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
		logger.info("DrugBagWranglerStore reset");
	}
}
