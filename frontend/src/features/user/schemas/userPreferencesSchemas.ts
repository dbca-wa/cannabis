import { z } from "zod";

// Theme choices matching backend UserPreferences.ThemeChoices
export const themeChoiceEnum = z.enum(["light", "dark", "system"], {
	message: "Please select a valid theme",
});

// Display mode choices matching backend UserPreferences.DisplayModeChoices
export const displayModeChoiceEnum = z.enum(["grid", "list"], {
	message: "Please select a valid display mode",
});

// Items per page choices matching backend UserPreferences.ItemsPerPageChoices
export const itemsPerPageChoiceEnum = z
	.number()
	.refine((val) => [10, 25, 50, 100].includes(val), {
		message: "Please select a valid items per page option",
	});

// Date format choices matching backend UserPreferences.DateFormatChoices
export const dateFormatChoiceEnum = z.enum(
	["d/m/Y", "m/d/Y", "Y-m-d", "d F Y"],
	{
		message: "Please select a valid date format",
	}
);

// Time format choices matching backend UserPreferences.TimeFormatChoices
export const timeFormatChoiceEnum = z.enum(["g:i A", "H:i"], {
	message: "Please select a valid time format",
});

// User preferences schema matching UserPreferencesSerializer
export const userPreferencesSchema = z.object({
	// Theme preferences
	theme: themeChoiceEnum,

	// Display preferences
	submissions_display_mode: displayModeChoiceEnum,
	certificates_display_mode: displayModeChoiceEnum,

	// Pagination preferences
	items_per_page: itemsPerPageChoiceEnum,

	// Notification preferences
	email_notifications: z.boolean(),
	comment_notifications: z.boolean(),
	reaction_notifications: z.boolean(),
	notify_submission_assigned: z.boolean(),
	notify_phase_changes: z.boolean(),
	notify_certificate_generated: z.boolean(),
	notify_invoices_generated: z.boolean(),
	notify_pdfs_mailed: z.boolean(),

	// Accessibility preferences
	reduce_motion: z.boolean(),

	// Date/Time preferences
	date_format: dateFormatChoiceEnum,
	time_format: timeFormatChoiceEnum,

	// Computed fields (read-only, not for forms)
	is_dark_mode: z.boolean().optional(),
	css_theme_class: z.string().optional(),
	display_preferences: z
		.object({
			submissions: displayModeChoiceEnum,
			certificates: displayModeChoiceEnum,
		})
		.optional(),
	notification_settings: z
		.object({
			email: z.boolean(),
			comments: z.boolean(),
			reactions: z.boolean(),
			assigned: z.boolean(),
			phase_changes: z.boolean(),
			certificates: z.boolean(),
			invoices: z.boolean(),
			sent: z.boolean(),
		})
		.optional(),
});

// Partial schema for updating preferences (all fields optional)
export const updateUserPreferencesSchema = userPreferencesSchema.partial();

export type UserPreferencesFormData = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesFormData = z.infer<
	typeof updateUserPreferencesSchema
>;
