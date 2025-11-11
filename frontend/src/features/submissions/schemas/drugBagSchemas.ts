import { z } from "zod";

// Drug bag content type choices (matches backend)
export const drugBagContentTypeSchema = z.enum([
	"plant",
	"plant_material",
	"cutting",
	"stalk",
	"stem",
	"seed",
	"seed_material",
	"unknown_seed",
	"seedling",
	"head",
	"rootball",
	"poppy",
	"poppy_plant",
	"poppy_capsule",
	"poppy_head",
	"poppy_seed",
	"mushroom",
	"tablet",
	"unknown",
	"unsure",
]);

// Create drug bag schema (matches DrugBagCreateSerializer)
export const createDrugBagSchema = z.object({
	submission: z.number().positive("Submission ID is required"),
	content_type: drugBagContentTypeSchema,
	seal_tag_numbers: z
		.string()
		.min(1, "Seal tag numbers are required")
		.max(100, "Seal tag numbers must be 100 characters or less")
		.trim(),
	new_seal_tag_numbers: z
		.string()
		.max(100, "New seal tag numbers must be 100 characters or less")
		.trim()
		.optional()
		.nullable(),
	property_reference: z
		.string()
		.max(20, "Property reference must be 20 characters or less")
		.trim()
		.optional()
		.nullable(),
	gross_weight: z
		.string()
		.refine((val) => !val || /^\d+(\.\d{1,3})?$/.test(val), {
			message:
				"Gross weight must be a valid decimal number (up to 3 decimal places)",
		})
		.optional()
		.nullable(),
	net_weight: z
		.string()
		.refine((val) => !val || /^\d+(\.\d{1,3})?$/.test(val), {
			message:
				"Net weight must be a valid decimal number (up to 3 decimal places)",
		})
		.optional()
		.nullable(),
});

// Update drug bag schema (matches DrugBagUpdateRequest)
export const updateDrugBagSchema = z.object({
	content_type: drugBagContentTypeSchema.optional(),
	seal_tag_numbers: z
		.string()
		.min(1, "Seal tag numbers are required")
		.max(100, "Seal tag numbers must be 100 characters or less")
		.trim()
		.optional(),
	new_seal_tag_numbers: z
		.string()
		.max(100, "New seal tag numbers must be 100 characters or less")
		.trim()
		.optional()
		.nullable(),
	property_reference: z
		.string()
		.max(20, "Property reference must be 20 characters or less")
		.trim()
		.optional()
		.nullable(),
	gross_weight: z
		.string()
		.refine((val) => !val || /^\d+(\.\d{1,3})?$/.test(val), {
			message:
				"Gross weight must be a valid decimal number (up to 3 decimal places)",
		})
		.optional()
		.nullable(),
	net_weight: z
		.string()
		.refine((val) => !val || /^\d+(\.\d{1,3})?$/.test(val), {
			message:
				"Net weight must be a valid decimal number (up to 3 decimal places)",
		})
		.optional()
		.nullable(),
});

// Form data types
export type CreateDrugBagFormData = z.infer<typeof createDrugBagSchema>;
export type UpdateDrugBagFormData = z.infer<typeof updateDrugBagSchema>;
