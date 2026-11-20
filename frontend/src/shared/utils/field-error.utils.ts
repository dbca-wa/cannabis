import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

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

/**
 * The server's message for each field it rejected, from an API error.
 *
 * The API client turns a validation response into `fieldErrors`; older code
 * paths may still carry the raw `response.data`. Only the first message per
 * field is kept, and the development "debug" block is ignored.
 */
export const serverFieldErrors = (error: unknown): Record<string, string> => {
	if (typeof error !== "object" || error === null) return {};
	const raw =
		(error as { fieldErrors?: Record<string, unknown> }).fieldErrors ??
		(error as { response?: { data?: unknown } }).response?.data;
	if (typeof raw !== "object" || raw === null) return {};
	const out: Record<string, string> = {};
	for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
		if (field === "debug") continue;
		const first = Array.isArray(value) ? value[0] : value;
		if (typeof first === "string" && first.trim()) out[field] = first;
	}
	return out;
};

/**
 * Show the server's field errors under the matching form fields, so the
 * message stays beside the field instead of only in a passing toast.
 * Returns true when at least one field error was shown.
 */
export const applyServerFieldErrors = <T extends FieldValues>(
	error: unknown,
	setError: UseFormSetError<T>,
	fields: readonly Path<T>[]
): boolean => {
	const errors = serverFieldErrors(error);
	let shown = false;
	for (const field of fields) {
		const message = errors[field];
		if (message) {
			setError(field, { type: "server", message });
			shown = true;
		}
	}
	return shown;
};
