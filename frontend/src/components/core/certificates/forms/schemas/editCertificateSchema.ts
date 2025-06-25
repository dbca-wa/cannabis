import z from "zod";

export const editCertificateSchema = z.object({
	identification_fee: z.number().min(0, "Fee must be a positive number"),
	submission: z.number().min(1, "Submission ID is required"),
});
