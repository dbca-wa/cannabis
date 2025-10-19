import { z } from "zod";
import type { OfficerRank } from "@/shared/types/backend-api.types";

// Officer rank choices (matches Django PoliceOfficer.SeniorityChoices)
const officerRankChoices: [OfficerRank, ...OfficerRank[]] = [
	"unknown",
	"unsworn_officer",
	"sworn_officer",
	"constable",
	"police_constable",
	"first_class_constable",
	"senior_constable",
	"detective",
	"detective_first_class_constable",
	"detective_senior_constable",
	"senior_detective",
	"sergeant",
	"inspector",
	"other",
];

// Create officer schema
export const createOfficerSchema = z.object({
	badge_number: z
		.string()
		.max(20, "Badge number cannot exceed 20 characters")
		.optional(),
	first_name: z
		.string()
		.max(100, "First name cannot exceed 100 characters")
		.trim()
		.optional(),
	last_name: z
		.string()
		.min(1, "Last name is required")
		.max(100, "Last name cannot exceed 100 characters")
		.trim(),
	rank: z.enum(officerRankChoices),
	station: z
		.union([
			z.string().min(1, "Please select a valid station"),
			z.literal("none"),
		])
		.optional(),
});

// Edit officer schema (same as create for now)
export const editOfficerSchema = createOfficerSchema;

// Type inference from schemas
export type CreateOfficerFormData = z.infer<typeof createOfficerSchema>;
export type EditOfficerFormData = z.infer<typeof editOfficerSchema>;

// Officer rank options for select components
export const officerRankOptions = officerRankChoices.map((rank) => ({
	value: rank,
	label: rank
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" "),
}));
