import { z } from "zod";

/**
 * Invoice validation schemas
 * These schemas match the Django Invoice model constraints
 */

// Invoice fee type enum
export const invoiceFeeTypeSchema = z.enum(["fuel", "call_out", "forensic"]);

// Additional invoice fee schema
export const additionalInvoiceFeeSchema = z.object({
	claim_kind: invoiceFeeTypeSchema,
	units: z.number().int().positive("Units must be a positive number"),
	description: z.string().max(200).optional().nullable(),
});

export type AdditionalInvoiceFeeFormData = z.infer<
	typeof additionalInvoiceFeeSchema
>;

// Invoice creation schema
export const createInvoiceSchema = z.object({
	submission: z.number().int().positive("Submission ID is required"),
	customer_number: z
		.string()
		.min(1, "Customer number is required")
		.max(20, "Customer number must be 20 characters or less"),
});

export type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

// Invoice edit schema
export const editInvoiceSchema = z.object({
	customer_number: z
		.string()
		.min(1, "Customer number is required")
		.max(20, "Customer number must be 20 characters or less"),
});

export type EditInvoiceFormData = z.infer<typeof editInvoiceSchema>;

// Invoice search schema
export const invoiceSearchSchema = z.object({
	search: z.string().optional(),
	submission: z.number().int().positive().optional(),
	ordering: z.string().optional(),
	limit: z.number().int().positive().max(100).optional(),
	offset: z.number().int().min(0).optional(),
});

export type InvoiceSearchFormData = z.infer<typeof invoiceSearchSchema>;
