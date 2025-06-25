import { z } from "zod";

export const addUserSchema = z
	.object({
		first_name: z.string().min(1, "First name is required"),
		last_name: z.string().min(1, "Last name is required"),
		username: z.string().min(3, "Username must be at least 3 characters"),
		email: z.string().email("Invalid email address"),
		role: z.enum(["none", "botanist", "police", "finance"]),

		// Police-specific fields (conditional validation handled in form)
		police_id: z.string().optional(),
		station: z.string().optional(),
		rank: z.string().optional(),
		is_sworn: z.boolean().default(false).optional(),
	})
	.refine(
		(data) => {
			// If role is police, require police_id
			if (data.role === "police") {
				return data.police_id && data.police_id.trim().length > 0;
			}
			return true;
		},
		{
			message: "Police ID is required for police users",
			path: ["police_id"],
		}
	);
