import { z } from "zod";

// Matches UserUpdateRequest interface and backend validation constraints
export const editUserSchema = z.object({
	email: z
		.string()
		.email("Please enter a valid email address")
		.refine((email) => email.endsWith("@dbca.wa.gov.au"), {
			message: "Email must be a DBCA email address (@dbca.wa.gov.au)",
		})
		.optional(),
	first_name: z
		.string()
		.min(1, "First name is required")
		.max(100, "First name must be 100 characters or less")
		.optional(),
	last_name: z
		.string()
		.min(1, "Last name is required")
		.max(100, "Last name must be 100 characters or less")
		.optional(),
	role: z
		.enum(["botanist", "finance", "none"], {
			message: "Please select a valid role",
		})
		.optional(),
	is_staff: z.boolean().optional(),
	is_active: z.boolean().optional(),
	it_asset_id: z
		.number()
		.positive("IT Asset ID must be a positive number")
		.optional()
		.nullable(),
	employee_id: z
		.string()
		.max(50, "Employee ID must be 50 characters or less")
		.optional()
		.nullable(),
});

export type EditUserFormData = z.infer<typeof editUserSchema>;
