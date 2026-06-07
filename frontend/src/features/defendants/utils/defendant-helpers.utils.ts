import type {
	Defendant,
	DefendantTiny,
} from "@/shared/types/backend-api.types";

/** Check if defendant can be deleted (no associated cases) */
export const canDeleteDefendant = (
	defendant: DefendantTiny | Defendant
): boolean => {
	return defendant.cases_count === 0;
};

/** Get deletion warning message for defendants with cases */
export const getDeletionWarningMessage = (
	defendant: DefendantTiny | Defendant
): string => {
	const count = defendant.cases_count;
	if (count === 0) return "";

	return `Cannot delete defendant ${defendant.full_name}. They are associated with ${count} case(s). Please remove them from all cases before deletion.`;
};
