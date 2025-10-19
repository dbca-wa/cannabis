import { z } from "zod";

// Create station schema - matches Django model constraints
export const createStationSchema = z.object({
	name: z
		.string()
		.min(1, "Station name is required")
		.max(200, "Station name must be 200 characters or less"),
	address: z.string().min(1, "Address is required"),
	phone: z.string().min(1, "Phone number is required"),
});

// Edit station schema - same as create for now
export const editStationSchema = createStationSchema;

// Type inference from schemas
export type CreateStationFormData = z.infer<typeof createStationSchema>;
export type EditStationFormData = z.infer<typeof editStationSchema>;
