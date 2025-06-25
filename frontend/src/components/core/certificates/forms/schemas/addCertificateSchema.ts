import z from "zod";

export const addCertificateSchema = z.object({
	identification_fee: z
		.number()
		.min(0, "Fee must be a positive number")
		.default(10),
	submission: z.number().min(1, "Submission ID is required"),
});
