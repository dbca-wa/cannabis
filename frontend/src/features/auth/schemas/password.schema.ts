import { z } from "zod";

// Password validation schema matching backend requirements
export const passwordSchema = z
	.string()
	.min(10, "Password must be at least 10 characters long")
	.regex(/[A-Za-z]/, "Password must contain at least one letter")
	.regex(/\d/, "Password must contain at least one number")
	.regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");

export const passwordUpdateSchema = z
	.object({
		currentPassword: z.string().optional(),
		newPassword: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

export type PasswordUpdateFormData = z.infer<typeof passwordUpdateSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;