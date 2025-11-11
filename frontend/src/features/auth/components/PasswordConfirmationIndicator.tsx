import { cn } from "@/shared/utils/index";
import { usePasswordConfirmation } from "@/features/auth/hooks/usePasswordValidation";

interface PasswordConfirmationIndicatorProps {
    password: string;
    confirmPassword: string;
    className?: string;
    showIndicator?: boolean;
}

export const PasswordConfirmationIndicator = ({
    password,
    confirmPassword,
    className,
    showIndicator = true,
}: PasswordConfirmationIndicatorProps) => {
    const validation = usePasswordConfirmation(password, confirmPassword);

    // Don't show anything if confirm password is empty
    if (!confirmPassword || confirmPassword.length === 0) {
        return null;
    }

    if (!showIndicator) {
        return null;
    }

    return (
        <div className={cn("mt-1", className)}>
            <div
                className={cn(
                    "flex items-center text-sm transition-colors",
                    validation.isMatching ? "text-green-600" : "text-red-600"
                )}
            >
                <div
                    className={cn(
                        "w-4 h-4 rounded-full mr-2 flex items-center justify-center text-xs",
                        validation.isMatching
                            ? "bg-green-100 text-green-600"
                            : "bg-red-100 text-red-600"
                    )}
                >
                    {validation.isMatching ? "✓" : "✗"}
                </div>
                {validation.isMatching ? "Passwords match" : validation.error}
            </div>
        </div>
    );
};