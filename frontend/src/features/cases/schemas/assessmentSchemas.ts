import { z } from "zod";

// Botanical determination choices (matches backend)
export const botanicalDeterminationSchema = z.enum([
	"pending",
	"cannabis_sativa",
	"cannabis_indica",
	"cannabis_hybrid",
	"mixed",
	"papaver_somniferum",
	"degraded",
	"not_cannabis",
	"unidentifiable",
	"inconclusive",
]);

// Botanical assessment schema (matches BotanicalAssessmentRequest)
export const botanicalAssessmentSchema = z.object({
	determination: botanicalDeterminationSchema.optional().nullable(),
	assessment_date: z
		.string()
		.refine((date) => !date || !isNaN(Date.parse(date)), {
			message: "Please enter a valid assessment date and time",
		})
		.optional()
		.nullable(),
	botanist_notes: z
		.string()
		.max(2000, "Botanist notes must be 2000 characters or less")
		.optional()
		.nullable(),
});

// Form data type
export type BotanicalAssessmentFormData = z.infer<
	typeof botanicalAssessmentSchema
>;
