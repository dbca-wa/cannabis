import { z } from "zod";

// Matches UserCreateSerializer exactly
export const addUserSchema = z
	.object({
		email: z
			.string()
			.email("Please enter a valid email address")
			.refine((email) => email.endsWith("@dbca.wa.gov.au"), {
				message: "Email must be a DBCA email address (@dbca.wa.gov.au)",
			}),
		first_name: z
			.string()
			.min(1, "First name is required")
			.max(100, "First name must be 100 characters or less"),
		last_name: z
			.string()
			.min(1, "Last name is required")
			.max(100, "Last name must be 100 characters or less"),
		role: z.enum(["botanist", "finance", "none"], {
			message: "Please select a valid role",
		}),
		password: z.string().min(8, "Password must be at least 8 characters"),
		password_confirm: z
			.string()
			.min(8, "Password confirmation is required"),
		is_staff: z.boolean().default(false),
		is_active: z.boolean().default(true),
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
	})
	.refine((data) => data.password === data.password_confirm, {
		message: "Passwords don't match",
		path: ["password_confirm"],
	});

export type AddUserFormData = z.infer<typeof addUserSchema>;
