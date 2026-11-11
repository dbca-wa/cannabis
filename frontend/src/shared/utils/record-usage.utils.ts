/** Add the chosen replacement to a delete request, when there is one. */
export const withReplacement = (
	url: string,
	replacementId: number | null | undefined
): string =>
	replacementId
		? `${url}?replacement=${encodeURIComponent(replacementId)}`
		: url;

/** Readable names for how a case uses a record. */
const ROLE_LABELS: Record<string, string> = {
	conveying: "Conveying officer",
	requesting: "Requesting officer",
	station: "Police station",
	defendant: "Defendant",
};

/** "Conveying officer and requesting officer" for the roles a case uses. */
export const describeRoles = (roles: string[]): string => {
	const labels = roles.map((role) => ROLE_LABELS[role] ?? role);
	if (labels.length <= 1) return labels[0] ?? "";
	const rest = labels.slice(1).map((label) => label.toLowerCase());
	return [labels[0], ...rest].join(" and ");
};
