import z from "zod";

export const addOrganisationSchema = z.object({
	name: z.string().min(1, "Organisation name is required"),
	address: z.string().optional(),
	phone_number: z.string().optional(),
	email: z
		.string()
		.email("Invalid email address")
		.optional()
		.or(z.literal("")),
});
