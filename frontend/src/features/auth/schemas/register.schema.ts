import z from "zod";

export const registerSchema = z.object({
	email: z
		.string()
		.email("Please enter a valid email address")
		.refine((email) => email.endsWith("@dbca.wa.gov.au"), {
			message: "Email must be a DBCA email address (@dbca.wa.gov.au)",
		}),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
