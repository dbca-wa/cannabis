/**
 * Word a server field error for a person to read.
 *
 * Most of the server's own messages are already full sentences ("An officer
 * named … already exists …", "This invoice-raised number is already used …")
 * and read badly with a code name such as "last_name:" in front. Generic
 * framework messages ("This field is required.") do not say which field, so
 * those get a readable field name first.
 *
 * @example describeFieldError("last_name", "This field is required.")
 *   // "Last name: This field is required."
 */
export const describeFieldError = (field: string, message: string): string => {
	const generic = /^(this field|ensure this (field|value)|this value)/i.test(
		message.trim()
	);
	if (!generic || field === "non_field_errors") return message;
	const label = field.replace(/_/g, " ").trim();
	return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${message}`;
};
