import { z } from "zod";

/**
 * Certificate validation schemas
 * schemas match the Django Certificate model
 */

// Certificate creation schema
export const createCertificateSchema = z.object({
	submission: z.number().int().positive("Submission ID is required"),
});

export type CreateCertificateFormData = z.infer<typeof createCertificateSchema>;

// Certificate edit schema (currently no editable fields besides submission)
export const editCertificateSchema = z.object({
	submission: z.number().int().positive("Submission ID is required"),
});

export type EditCertificateFormData = z.infer<typeof editCertificateSchema>;

// Certificate search schema
export const certificateSearchSchema = z.object({
	search: z.string().optional(),
	submission: z.number().int().positive().optional(),
	ordering: z.string().optional(),
	limit: z.number().int().positive().max(100).optional(),
	offset: z.number().int().min(0).optional(),
});

export type CertificateSearchFormData = z.infer<typeof certificateSearchSchema>;
