import { z } from "zod";

// Create station schema - matches Django model constraints
export const createStationSchema = z.object({
	name: z
		.string()
		.min(1, "Station name is required")
		.max(200, "Station name must be 200 characters or less"),
	address: z.string(),
	phone: z.string(),
});

// Edit station schema - same constraints as create
export const editStationSchema = createStationSchema;

// Type inference from schemas
export type CreateStationFormData = z.infer<typeof createStationSchema>;
export type EditStationFormData = z.infer<typeof editStationSchema>;
