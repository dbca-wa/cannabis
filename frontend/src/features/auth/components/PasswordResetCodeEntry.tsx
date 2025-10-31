import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation } from "react-router";
import { toast } from "sonner";

import { resetCodeSchema, type ResetCodeFormData } from "@/features/auth/schemas/password.schema";

import { Button } from "@/shared/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import CannabisLogo from "@/shared/components/layout/CannabisLogo";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { storage } from "@/shared/services/storage.service";
import { authService } from "@/features/auth/services/auth.service";

interface VerifyResetCodeResponse {
    message: string;
    access: string;
    refresh: string;
    user: {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        is_staff: boolean;
        is_superuser: boolean;
    };
}

export const PasswordResetCodeEntry = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get email and duplicate flag from location state
    const email = location.state?.email;
    const isDuplicate = location.state?.isDuplicate === true;

    const form = useForm<ResetCodeFormData>({
        resolver: zodResolver(resetCodeSchema),
        defaultValues: {
            code: "",
        },
    });

    const onSubmit = async (values: ResetCodeFormData) => {
        if (!email) {
            toast.error("Email address not available. Please start the password reset process again.");
            navigate("/auth/login");
            return;
        }

        setIsSubmitting(true);
        logger.info("Reset code verification submitted", { code: values.code, email });

        try {
            // Verify the reset code with the backend
            const response = await apiClient.postPublic<VerifyResetCodeResponse>(
                ENDPOINTS.AUTH.VERIFY_RESET_CODE,
                {
                    email: email,
                    code: values.code,
                }
            );

            logger.info("Reset code verified successfully", {
                userId: response.user.id,
                email: response.user.email
            });

            // Store tokens (auto-login)
            storage.setTokens(response.access, response.refresh);

            // Verify that tokens are properly stored before navigation
            if (!authService.hasValidTokens()) {
                logger.error("Tokens not properly stored after verification", {
                    hasAccess: !!storage.getAccessToken(),
                    hasRefresh: !!storage.getRefreshToken()
                });
                toast.error("Authentication failed. Please try again.");
                return;
            }

            // Fetch and cache the complete user data
            try {
                const userResult = await authService.getCurrentUser();
                if (!userResult.success) {
                    logger.error("Failed to fetch user data after token storage", {
                        error: userResult.error
                    });
                    toast.error("Authentication failed. Please try again.");
                    return;
                }

                logger.info("Authentication state updated successfully", {
                    userId: userResult.data.id,
                    hasValidTokens: authService.hasValidTokens()
                });
            } catch (error) {
                logger.error("Exception while fetching user data", { error });
                toast.error("Authentication failed. Please try again.");
                return;
            }

            toast.success("Code verified! Redirecting to password update...");

            // Navigate to password update page
            navigate("/auth/password-update", {
                state: {
                    isFirstTime: true,
                    fromResetCode: true
                }
            });

        } catch (error) {
            const errorMessage = getErrorMessage(error);
            logger.error("Reset code verification failed", {
                code: values.code,
                error: errorMessage,
            });

            // Handle specific error cases
            if (errorMessage.includes("invalid") || errorMessage.includes("incorrect")) {
                form.setError("code", {
                    type: "manual",
                    message: "The code you entered is incorrect. Please try again.",
                });
            } else if (errorMessage.includes("expired")) {
                form.setError("code", {
                    type: "manual",
                    message: "This code has expired. Please request a new password reset.",
                });
            } else if (errorMessage.includes("attempts") || errorMessage.includes("too many")) {
                form.setError("code", {
                    type: "manual",
                    message: "Too many incorrect attempts. Please request a new password reset.",
                });
            } else if (errorMessage.includes("used")) {
                form.setError("code", {
                    type: "manual",
                    message: "This code has already been used. Please request a new password reset.",
                });
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackToLogin = () => {
        navigate("/auth/login");
    };

    const handleRequestNewCode = () => {
        if (email) {
            // If we have the email, go directly to the forgot password flow
            navigate("/auth/login", {
                state: {
                    showForgotPassword: true,
                    prefillEmail: email
                }
            });
        } else {
            // Otherwise, just go to login
            navigate("/auth/login", {
                state: {
                    showForgotPassword: true
                }
            });
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl text-center">
                    <CannabisLogo shouldAnimate />
                </CardTitle>
                <div className="text-center">
                    <h2 className="text-xl font-semibold">Enter Reset Code</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {isDuplicate
                            ? "A reset code was already sent to your email address. Please enter the code from your existing email."
                            : "Enter the 4-digit code sent to your email address"
                        }
                    </p>
                    {email && (
                        <p className="text-sm font-medium text-muted-foreground mt-1">
                            {email}
                        </p>
                    )}
                    {isDuplicate && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                            <p><strong>Note:</strong> No new email was sent. Please check your existing email for the 4-digit code.</p>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            name="code"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reset Code</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="text"
                                            placeholder="Enter 4-digit code"
                                            disabled={isSubmitting}
                                            maxLength={4}
                                            className="text-center text-2xl font-mono tracking-widest"
                                            autoComplete="one-time-code"
                                            onChange={(e) => {
                                                // Only allow numeric input
                                                const value = e.target.value.replace(/\D/g, '');
                                                field.onChange(value);
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <Button
                                type="submit"
                                className="w-full"
                                variant="cannabis"
                                disabled={isSubmitting || form.watch("code").length !== 4}
                            >
                                {isSubmitting ? "Verifying..." : "Verify Code"}
                            </Button>

                            <div className="flex space-x-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={handleBackToLogin}
                                    disabled={isSubmitting}
                                >
                                    Back to Login
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={handleRequestNewCode}
                                    disabled={isSubmitting}
                                >
                                    Request New Code
                                </Button>
                            </div>
                        </div>

                        <div className="text-center text-xs text-muted-foreground">
                            <p>Didn't receive the code? Check your spam folder.</p>
                            <p className="mt-1">Codes expire after 24 hours and can only be used once.</p>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};