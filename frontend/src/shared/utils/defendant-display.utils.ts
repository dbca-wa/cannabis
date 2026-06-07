import type {
	DefendantTiny,
	Defendant,
} from "@/shared/types/backend-api.types";

/**
 * Format defendant display name for UI components.
 */
export const formatDefendantDisplayName = (
	defendant: DefendantTiny | Defendant
): string => {
	return defendant.full_name;
};

/**
 * Get defendant cases badge text for UI components.
 */
export const getDefendantCasesBadge = (
	defendant: DefendantTiny | Defendant
): string => {
	const count = defendant.cases_count;
	if (count === 0) return "No Cases";
	if (count === 1) return "1 Case";
	return `${count} Cases`;
};

/**
 * Get defendant cases badge colour class for UI components.
 */
export const getDefendantCasesBadgeColourClass = (
	defendant: DefendantTiny | Defendant
): string => {
	const count = defendant.cases_count;

	if (count === 0) {
		return "text-gray-600";
	} else if (count <= 2) {
		return "text-blue-600";
	} else if (count <= 5) {
		return "text-yellow-600";
	} else {
		return "text-red-600";
	}
};

/**
 * Get defendant initials for avatar display.
 */
export const getDefendantInitials = (
	defendant: DefendantTiny | Defendant
): string => {
	const givenNames = defendant.given_names?.trim();
	const lastName = defendant.last_name?.trim();

	if (givenNames && lastName) {
		return `${givenNames.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	} else if (lastName) {
		return lastName.charAt(0).toUpperCase();
	} else if (givenNames) {
		return givenNames.charAt(0).toUpperCase();
	}

	return "D";
};
