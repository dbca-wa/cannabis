/**
 * Pure helpers for the bulk "add multiple bags" modal, kept out of the
 * component file so they can be unit-tested and so the component file only
 * exports the component (required for fast refresh).
 */

import type {
	BotanicalDetermination,
	DrugBagContentType,
} from "../../../types/drugBags.types";

export interface BulkBagEntry {
	id: string;
	seal_tag_numbers: string;
	new_seal_tag_numbers: string;
	content_type: DrugBagContentType;
	determination: BotanicalDetermination;
	contains_female_plants: boolean;
}

/** Female plants only apply to plant content types, matching single-bag entry. */
export const isPlantContent = (t: DrugBagContentType): boolean =>
	t === "plant" || t === "plant_material";

/**
 * Grow or shrink the list of bag entries to `newCount` while keeping the data
 * already entered. Existing entries are preserved in order; extra entries are
 * appended using the given defaults; surplus entries are dropped from the end.
 *
 * Rebuilding the list from scratch on a count change wiped tags, content type,
 * determination and the female-plants flag, which lost a user's work when they
 * added or removed one bag after filling the others in.
 */
export const resizeEntries = (
	prev: BulkBagEntry[],
	newCount: number,
	defaults: {
		content_type: DrugBagContentType;
		determination: BotanicalDetermination;
	},
	makeId: (index: number) => string
): BulkBagEntry[] => {
	if (newCount <= prev.length) {
		return prev.slice(0, newCount);
	}
	const next = [...prev];
	for (let i = prev.length; i < newCount; i++) {
		next.push({
			id: makeId(i),
			seal_tag_numbers: "",
			new_seal_tag_numbers: "",
			content_type: defaults.content_type,
			determination: defaults.determination,
			contains_female_plants: false,
		});
	}
	return next;
};
