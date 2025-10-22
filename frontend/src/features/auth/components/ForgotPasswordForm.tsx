import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

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
            const response = await apiClient.postPublic<{ message: string }>(
                ENDPOINTS.AUTH.FORGOT_PASSWORD,
                {
                    email: values.email,
                }
            );

            logger.info("Password reset email sent successfully", { email: values.email });
            setIsSuccess(true);
            toast.success("Password reset email sent! Check your inbox.");

            // Call success callback after a short delay
            setTimeout(() => {
                onSuccess?.();
            }, 2000);
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            logger.error("Forgot password request failed", {
                email: values.email,
                error: errorMessage,
            });
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="space-y-4 text-center">
                <div className="text-green-600 text-4xl mb-4">✓</div>
                <div>
                    <h3 className="text-lg font-semibold text-green-600">Email Sent!</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        We've sent a password reset link to your email address.
                        Please check your inbox and follow the instructions to reset your password.
                    </p>
                </div>
                <div className="text-xs text-muted-foreground">
                    Didn't receive the email? Check your spam folder or try again in a few minutes.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="text-center">
                <h3 className="text-lg font-semibold">Reset Your Password</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Enter your email address and we'll send you a link to reset your password.
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
                            {isSubmitting ? "Sending..." : "Send Reset Link"}
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