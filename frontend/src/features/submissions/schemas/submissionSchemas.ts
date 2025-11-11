import { z } from "zod";

// Submission phase choices (matches backend)
export const submissionPhaseSchema = z.enum([
	"data_entry_start",
	"finance_approval_provided",
	"botanist_approval_provided",
	"in_review",
	"certificate_generation_start",
	"invoice_generation_start",
	"sending_emails",
	"complete",
]);

// Create submission schema (matches SubmissionCreateSerializer)
export const createSubmissionSchema = z.object({
	case_number: z
		.string()
		.min(1, "Case number is required")
		.max(50, "Case number must be 50 characters or less")
		.trim(),
	received: z
		.string()
		.min(1, "Received date is required")
		.refine((date) => !isNaN(Date.parse(date)), {
			message: "Please enter a valid date and time",
		}),
	security_movement_envelope: z
		.string()
		.min(1, "Security movement envelope is required")
		.max(20, "Security movement envelope must be 20 characters or less")
		.trim(),
	requesting_officer: z
		.number()
		.positive("Please select a requesting officer")
		.optional()
		.nullable(),
	submitting_officer: z
		.number()
		.positive("Please select a submitting officer")
		.optional()
		.nullable(),
	defendants: z.array(z.number().positive()).optional().default([]),
});

// Update submission schema (matches SubmissionUpdateSerializer)
export const updateSubmissionSchema = z.object({
	approved_botanist: z
		.number()
		.positive("Please select an approved botanist")
		.optional()
		.nullable(),
	finance_officer: z
		.number()
		.positive("Please select a finance officer")
		.optional()
		.nullable(),
	internal_comments: z
		.string()
		.max(1000, "Internal comments must be 1000 characters or less")
		.optional()
		.nullable(),
	defendants: z.array(z.number().positive()).optional().default([]),
	phase: submissionPhaseSchema.optional(),
});

// Workflow action schema
export const workflowActionSchema = z.object({
	action: z.enum(
		["advance_phase", "generate_certificate", "generate_invoice"],
		{
			message: "Please select a valid workflow action",
		}
	),
	customer_number: z
		.string()
		.min(1, "Customer number is required for invoice generation")
		.max(20, "Customer number must be 20 characters or less")
		.optional(),
});

// Submissions search schema
export const submissionsSearchSchema = z.object({
	search: z.string().optional(),
	phase: submissionPhaseSchema.or(z.literal("all")).optional(),
	botanist: z.number().positive().or(z.literal("all")).optional(),
	finance: z.number().positive().or(z.literal("all")).optional(),
	cannabis_only: z.boolean().optional(),
	date_from: z
		.string()
		.refine((date) => !date || !isNaN(Date.parse(date)), {
			message: "Please enter a valid from date",
		})
		.optional(),
	date_to: z
		.string()
		.refine((date) => !date || !isNaN(Date.parse(date)), {
			message: "Please enter a valid to date",
		})
		.optional(),
	ordering: z.string().optional(),
});

// Form data types
export type CreateSubmissionFormData = z.infer<typeof createSubmissionSchema>;
export type UpdateSubmissionFormData = z.infer<typeof updateSubmissionSchema>;
export type WorkflowActionFormData = z.infer<typeof workflowActionSchema>;
export type SubmissionsSearchFormData = z.infer<typeof submissionsSearchSchema>;
