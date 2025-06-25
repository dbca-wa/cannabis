import z from "zod";

export const addSubmissionSchema = z.object({
	police_officer: z.number().optional(),
	police_submitter: z.number().optional(),
	dbca_submitter: z.number().optional(),
});
