import { describe, it, expect, beforeEach } from "vitest";
import {
	CertificateGroupingStore,
	MAX_BAGS_PER_CERTIFICATE,
} from "./certificate-grouping.store";

describe("CertificateGroupingStore", () => {
	let store: CertificateGroupingStore;

	beforeEach(() => {
		store = new CertificateGroupingStore();
	});

	describe("seed + reconcile (auto-chunking)", () => {
		it("packs bags into groups of at most five", () => {
			store.seed([1, 2, 3, 4, 5, 6, 7]);

			expect(store.groupCount).toBe(2);
			expect(store.state.groups[0].bagIds).toEqual([1, 2, 3, 4, 5]);
			expect(store.state.groups[1].bagIds).toEqual([6, 7]);
			expect(MAX_BAGS_PER_CERTIFICATE).toBe(5);
		});

		it("seeds from existing certificate groups then folds in new bags", () => {
			store.seed([1, 2, 3], [[3, 1]], ["Section C note"]);

			// Existing order [3,1] preserved, new bag 2 appended, notes kept by position.
			expect(store.state.groups[0].bagIds).toEqual([3, 1, 2]);
			expect(store.state.groups[0].notes).toBe("Section C note");
		});

		it("drops bags that no longer exist on reconcile", () => {
			store.seed([1, 2, 3, 4, 5, 6, 7]);
			store.reconcile([1, 2, 3]);

			expect(store.groupCount).toBe(1);
			expect(store.state.groups[0].bagIds).toEqual([1, 2, 3]);
		});
	});

	describe("moveBag", () => {
		it("moves a bag into another certificate and repacks", () => {
			store.seed([1, 2, 3, 4, 5, 6]); // [[1..5],[6]]
			const changed = store.moveBag(1, 1);

			expect(changed).toBe(true);
			expect(store.state.groups[0].bagIds).toEqual([2, 3, 4, 5, 6]);
			expect(store.state.groups[1].bagIds).toEqual([1]);
			expect(store.groupIndexForBag(1)).toBe(1);
		});

		it("returns false for an unknown bag", () => {
			store.seed([1, 2, 3]);
			expect(store.moveBag(999, 0)).toBe(false);
		});

		it("returns false when the bag is already in the target group", () => {
			store.seed([1, 2, 3]);
			expect(store.moveBag(1, 0)).toBe(false);
		});
	});

	describe("notes + active index", () => {
		it("sets notes for a group by index", () => {
			store.seed([1, 2]);
			store.setNotes(0, "Updated notes");
			expect(store.state.groups[0].notes).toBe("Updated notes");
		});

		it("tracks the active certificate index", () => {
			store.seed([1, 2, 3, 4, 5, 6]);
			store.setActiveIndex(1);
			expect(store.state.activeIndex).toBe(1);
		});
	});

	describe("isValid", () => {
		it("is false with no groups", () => {
			expect(store.isValid).toBe(false);
		});

		it("is true when every group holds one to five bags", () => {
			store.seed([1, 2, 3, 4, 5, 6, 7]);
			expect(store.isValid).toBe(true);
		});
	});

	describe("reset", () => {
		it("clears groups and active index", () => {
			store.seed([1, 2, 3]);
			store.setActiveIndex(0);
			store.reset();

			expect(store.groupCount).toBe(0);
			expect(store.state.activeIndex).toBe(0);
			expect(store.isValid).toBe(false);
		});
	});
});
