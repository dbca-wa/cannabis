import { z } from "zod";

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8, "Required"),
});

export const registerSchema = z.object({
	username: z.string().trim().min(3, "Username is required"),
	email: z.string().email(),
	password: z.string().min(8, "Minimum of 8 characters required"),
});
