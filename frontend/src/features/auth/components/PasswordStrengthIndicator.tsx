import { cn } from "@/shared/utils/index";
import { usePasswordValidation } from "@/features/auth/hooks/usePasswordValidation";

interface PasswordStrengthIndicatorProps {
    password: string;
    className?: string;
    showServerValidation?: boolean;
    onServerValidation?: (isValid: boolean) => void;
}

export const PasswordStrengthIndicator = ({
    password,
    className,
    showServerValidation = false,
    onServerValidation,
}: PasswordStrengthIndicatorProps) => {
    const { validation, isValidatingOnServer } = usePasswordValidation(password);

    const getStrengthColor = (strength: number) => {
        if (strength === 0) return "bg-gray-200";
        if (strength <= 0.25) return "bg-red-500";
        if (strength <= 0.5) return "bg-orange-500";
        if (strength <= 0.75) return "bg-yellow-500";
        return "bg-green-500";
    };

    // Notify parent component about validation status
    if (onServerValidation && validation.isValid !== undefined) {
        onServerValidation(validation.isValid);
    }

    if (!password) return null;

    return (
        <div className={cn("space-y-2", className)}>
            {/* Strength bar */}
            <div className="space-y-1">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                        Password strength
                        {isValidatingOnServer && showServerValidation && (
                            <span className="ml-1 text-xs">(validating...)</span>
                        )}
                    </span>
                    <span
                        className={cn(
                            "font-medium",
                            validation.strength <= 0.25 && "text-red-600",
                            validation.strength > 0.25 && validation.strength <= 0.5 && "text-orange-600",
                            validation.strength > 0.5 && validation.strength <= 0.75 && "text-yellow-600",
                            validation.strength > 0.75 && "text-green-600"
                        )}
                    >
                        {validation.strengthText}
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={cn(
                            "h-2 rounded-full transition-all duration-300",
                            getStrengthColor(validation.strength)
                        )}
                        style={{ width: `${validation.strength * 100}%` }}
                    />
                </div>
            </div>

            {/* Requirements list */}
            <div className="space-y-1">
                {validation.requirements.map((req, index) => (
                    <div
                        key={index}
                        className={cn(
                            "flex items-center text-sm transition-colors",
                            req.met ? "text-green-600" : "text-muted-foreground"
                        )}
                    >
                        <div
                            className={cn(
                                "w-4 h-4 rounded-full mr-2 flex items-center justify-center text-xs",
                                req.met
                                    ? "bg-green-100 text-green-600"
                                    : "bg-gray-100 text-gray-400"
                            )}
                        >
                            {req.met ? "✓" : "○"}
                        </div>
                        {req.label}
                    </div>
                ))}
            </div>

            {/* Server validation errors */}
            {showServerValidation && validation.errors.length > 0 && (
                <div className="space-y-1">
                    <div className="text-sm font-medium text-red-600">
                        Password requirements not met:
                    </div>
                    {validation.errors.map((error, index) => (
                        <div key={index} className="flex items-center text-sm text-red-600">
                            <div className="w-4 h-4 rounded-full mr-2 flex items-center justify-center text-xs bg-red-100">
                                ✗
                            </div>
                            {error}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};