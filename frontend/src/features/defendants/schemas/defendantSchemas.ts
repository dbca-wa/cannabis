import { z } from "zod";

// Create defendant schema - matches Django model constraints
export const createDefendantSchema = z.object({
	given_names: z
		.string()
		.max(100, "Given names cannot exceed 100 characters")
		.trim()
		.optional()
		.or(z.literal("")), // Allow empty string which will be converted to null
	last_name: z
		.string()
		.min(1, "Last name is required")
		.max(100, "Last name cannot exceed 100 characters")
		.trim(),
});

// Edit defendant schema - same as create for now
export const editDefendantSchema = createDefendantSchema;

// Type inference from schemas
export type CreateDefendantFormData = z.infer<typeof createDefendantSchema>;
export type EditDefendantFormData = z.infer<typeof editDefendantSchema>;
