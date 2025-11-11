import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/features/auth/schemas/password.schema";

import { Button } from "@/shared/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { apiClient, ENDPOINTS } from "@/shared/services/api";

interface ForgotPasswordFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const ForgotPasswordForm = ({ onSuccess, onCancel }: ForgotPasswordFormProps) => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = async (values: ForgotPasswordFormData) => {
        setIsSubmitting(true);
        logger.info("Forgot password form submitted", { email: values.email });

        try {
            // Use proper API client (no auth required for forgot password)
            await apiClient.postPublic<{ message: string }>(
                ENDPOINTS.AUTH.FORGOT_PASSWORD,
                {
                    email: values.email,
                }
            );

            logger.info("Password reset code sent successfully", { email: values.email });
            toast.success("Reset code sent! Redirecting...");

            // Navigate to success page with email in state
            navigate("/auth/reset-success", {
                state: {
                    email: values.email
                }
            });

            // Call success callback if provided (for modal usage)
            onSuccess?.();
        } catch (error) {
            console.log("Full error object:", error);
            console.log("Error response data:", (error as any)?.response?.data);

            const errorResponse = (error as any)?.response?.data;
            const errorMessage = getErrorMessage(error);

            // Check if this is a duplicate request error
            if (errorResponse?.error_code === "DUPLICATE_REQUEST") {
                logger.info("Duplicate password reset request, navigating to code entry", { email: values.email });
                toast.success("A reset code was already sent. Redirecting to code entry...");

                // Navigate to code entry page with email and duplicate flag
                navigate("/auth/reset-code", {
                    state: {
                        email: values.email,
                        isDuplicate: true
                    }
                });

                // Call success callback if provided (for modal usage)
                onSuccess?.();
                return;
            }

            logger.error("Forgot password request failed", {
                email: values.email,
                error: errorMessage,
                fullError: error,
            });
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };



    return (
        <div className="space-y-4">
            <div className="text-center">
                <h3 className="text-lg font-semibold">Reset Your Password</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Enter your email address and we'll send you a 4-digit code to reset your password.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        name="email"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="email"
                                        placeholder="Enter your email address"
                                        disabled={isSubmitting}
                                        autoComplete="email"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex space-x-2">
                        <Button
                            type="submit"
                            className="flex-1"
                            variant="cannabis"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Sending..." : "Send Reset Code"}
                        </Button>
                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </Form>
        </div>
    );
};