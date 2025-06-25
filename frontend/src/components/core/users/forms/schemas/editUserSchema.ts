import { z } from "zod";

export const editUserSchema = z.object({
	first_name: z.string().min(1, "First name is required"),
	last_name: z.string().min(1, "Last name is required"),
	username: z.string().min(3, "Username must be at least 3 characters"),
	email: z.string().email("Invalid email address"),
	role: z.enum(["none", "botanist", "police", "finance"]),
	police_id: z.string().optional(),
	station: z.string().optional(), // This will store the station ID as a string
	rank: z.string().optional(),
	is_sworn: z.boolean().default(false).optional(),
});
