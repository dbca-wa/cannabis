/**
 * CertificateGroupingStore — MobX store that holds how a case's saved drug bags
 * are grouped into certificates, plus each certificate's Section C notes.
 *
 * Each group becomes one certificate and may hold at most five bags. Grouping
 * and notes are edited on the Assessment step and read back when generating
 * certificates (sent as `groups` + `group_notes`) and when rendering the
 * multi-certificate preview. It is seeded from any already-generated
 * certificates, otherwise the bags are auto-chunked into blocks of five.
 */

import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { makeObservable, action, computed } from "mobx";
import { logger } from "@/shared/services/logger.service";

export const MAX_BAGS_PER_CERTIFICATE = 5;

/** A single certificate group: the bags it covers and its Section C notes. */
export interface CertGroup {
	bagIds: number[];
	notes: string;
}

interface CertificateGroupingStoreState extends BaseStoreState {
	/** Ordered certificate groups */
	groups: CertGroup[];
	/** Currently focused certificate index (for navigation + bag-group highlight) */
	activeIndex: number;
}

const INITIAL_STATE: CertificateGroupingStoreState = {
	loading: false,
	error: null,
	initialised: false,
	groups: [],
	activeIndex: 0,
};

export class CertificateGroupingStore extends BaseStore<CertificateGroupingStoreState> {
	constructor() {
		super({ ...INITIAL_STATE, groups: [] });

		makeObservable(this, {
			seed: action,
			reconcile: action,
			moveBag: action,
			setNotes: action,
			setActiveIndex: action,
			reset: action,
			groupCount: computed,
			isValid: computed,
		});
	}

	/** Focus a certificate by index (navigator + bag-group highlight). */
	setActiveIndex = (index: number) => {
		this.state.activeIndex = index;
	};

	/** Set the Section C notes for a certificate group. */
	setNotes = (index: number, notes: string) => {
		const group = this.state.groups[index];
		if (group) group.notes = notes;
	};

	/**
	 * Re-chunk an ordered list of bag ids into tightly packed certificate groups
	 * of at most five bags. Earlier certificates are always full; the number of
	 * certificates is therefore ceil(total / 5). Each certificate's Section C
	 * notes are kept by position (certificate 1's notes stay on certificate 1).
	 */
	private repack(orderedBagIds: number[], notes: string[]): CertGroup[] {
		const groups: CertGroup[] = [];
		for (let i = 0; i < orderedBagIds.length; i += MAX_BAGS_PER_CERTIFICATE) {
			const index = groups.length;
			groups.push({
				bagIds: orderedBagIds.slice(i, i + MAX_BAGS_PER_CERTIFICATE),
				notes: notes[index] ?? "",
			});
		}
		return groups;
	}

	/**
	 * Seed grouping + notes from already-generated certificates (if any), then
	 * fold in every saved bag so the grouping always covers the case. The result
	 * is always tightly packed into blocks of five.
	 */
	seed = (
		savedBagIds: number[],
		certificateGroups?: number[][],
		certificateNotes?: string[]
	) => {
		if (certificateGroups && certificateGroups.length > 0) {
			const savedSet = new Set(savedBagIds);
			const order = certificateGroups
				.flatMap((group) => group)
				.filter((id) => savedSet.has(id));
			this.state.groups = this.repack(order, certificateNotes ?? []);
		} else {
			this.state.groups = [];
		}
		this.reconcile(savedBagIds);
	};

	/**
	 * Reconcile with the current saved bags: drop ids that no longer exist, keep
	 * the existing order, append any new bags at the end, then tightly re-pack so
	 * earlier certificates stay full and no empty/short certificates linger.
	 */
	reconcile = (savedBagIds: number[]) => {
		const savedSet = new Set(savedBagIds);
		const currentOrder = this.state.groups
			.flatMap((g) => g.bagIds)
			.filter((id) => savedSet.has(id));
		const placed = new Set(currentOrder);
		const appended = savedBagIds.filter((id) => !placed.has(id));
		const order = [...currentOrder, ...appended];
		const notes = this.state.groups.map((g) => g.notes);

		this.state.groups = this.repack(order, notes);
		this.state.initialised = true;
		logger.debug("CertificateGrouping reconciled", {
			groups: this.state.groups.length,
			bags: savedBagIds.length,
		});
	};

	/**
	 * Move a bag into another certificate. The bag is inserted at the top of the
	 * target certificate and the groups are tightly re-packed, so the displaced
	 * bags cascade (moving a bag down pulls the next certificate's top bag up).
	 * The certificate count never changes — it is fixed by the bag count.
	 *
	 * @returns true if the move changed anything
	 */
	moveBag = (bagId: number, targetIndex: number): boolean => {
		const order = this.state.groups.flatMap((g) => g.bagIds);
		const currentIndex = order.indexOf(bagId);
		if (currentIndex === -1) return false;

		const sourceGroup = Math.floor(currentIndex / MAX_BAGS_PER_CERTIFICATE);
		if (sourceGroup === targetIndex) return false;

		const notes = this.state.groups.map((g) => g.notes);
		const without = order.filter((id) => id !== bagId);
		const insertAt = Math.min(
			Math.max(targetIndex, 0) * MAX_BAGS_PER_CERTIFICATE,
			without.length
		);
		without.splice(insertAt, 0, bagId);

		this.state.groups = this.repack(without, notes);
		return true;
	};

	/** Index of the certificate group a bag belongs to, or -1. */
	groupIndexForBag = (bagId: number): number =>
		this.state.groups.findIndex((g) => g.bagIds.includes(bagId));

	reset() {
		this.state.groups = [];
		this.state.activeIndex = 0;
		this.state.loading = false;
		this.state.error = null;
		this.state.initialised = false;
		logger.info("CertificateGroupingStore reset");
	}

	/** Number of certificate groups. */
	get groupCount(): number {
		return this.state.groups.length;
	}

	/** Every group holds between one and five bags. */
	get isValid(): boolean {
		return (
			this.state.groups.length > 0 &&
			this.state.groups.every(
				(g) =>
					g.bagIds.length >= 1 && g.bagIds.length <= MAX_BAGS_PER_CERTIFICATE
			)
		);
	}
}
