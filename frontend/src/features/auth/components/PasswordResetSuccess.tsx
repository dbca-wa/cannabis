import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import CannabisLogo from "@/shared/components/layout/CannabisLogo";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { apiClient, ENDPOINTS } from "@/shared/services/api";

interface PasswordResetSuccessProps {
    email?: string;
}

export const PasswordResetSuccess = ({ email: propEmail }: PasswordResetSuccessProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isResending, setIsResending] = useState(false);

    // Get email from props or location state
    const email = propEmail || location.state?.email;

    const handleBackToLogin = () => {
        navigate("/auth/login");
    };

    const handleEnterCode = () => {
        navigate("/auth/reset-code", {
            state: {
                email: email
            }
        });
    };

    const handleResendCode = async () => {
        if (!email) {
            toast.error("Email address not available. Please start the password reset process again.");
            navigate("/auth/login");
            return;
        }

        setIsResending(true);
        logger.info("Resending password reset code", { email });

        try {
            await apiClient.postPublic<{ message: string }>(
                ENDPOINTS.AUTH.FORGOT_PASSWORD,
                {
                    email: email,
                }
            );

            logger.info("Password reset code resent successfully", { email });
            toast.success("New reset code sent! Check your email.");

        } catch (error) {
            const errorMessage = getErrorMessage(error);
            logger.error("Failed to resend password reset code", {
                email,
                error: errorMessage,
            });
            toast.error(errorMessage);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl text-center">
                    <CannabisLogo shouldAnimate />
                </CardTitle>
                <div className="text-center">
                    <div className="text-green-600 text-4xl mb-4">✓</div>
                    <h2 className="text-xl font-semibold text-green-600">Reset Code Sent!</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        We've sent a 4-digit reset code to your email address.
                    </p>
                    {email && (
                        <p className="text-sm font-medium text-muted-foreground mt-1">
                            {email}
                        </p>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <h3 className="font-semibold mb-2">Next Steps:</h3>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Check your email inbox for the reset code</li>
                        <li>Enter the 4-digit code on the next page</li>
                        <li>Create your new password</li>
                    </ol>
                </div>

                <div className="space-y-2">
                    <Button
                        onClick={handleEnterCode}
                        className="w-full"
                        variant="cannabis"
                    >
                        Enter Reset Code
                    </Button>

                    <div className="flex space-x-2">
                        <Button
                            onClick={handleBackToLogin}
                            variant="outline"
                            className="flex-1"
                        >
                            Back to Login
                        </Button>
                        <Button
                            onClick={handleResendCode}
                            variant="outline"
                            className="flex-1"
                            disabled={isResending || !email}
                        >
                            {isResending ? "Sending..." : "Resend Code"}
                        </Button>
                    </div>
                </div>

                <div className="text-center text-xs text-muted-foreground space-y-1">
                    <p>Didn't receive the email? Check your spam folder.</p>
                    <p>Reset codes expire after 24 hours and can only be used once.</p>
                    <p className="text-yellow-600">
                        <strong>Security Note:</strong> Never share your reset code with anyone.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};