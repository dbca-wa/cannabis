import { useMemo, useState, useCallback } from "react";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";

export interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
    met: boolean;
}

export interface PasswordValidationResult {
    isValid: boolean;
    strength: number; // 0-1 scale
    strengthText: string;
    requirements: PasswordRequirement[];
    errors: string[];
}

export interface PasswordConfirmationResult {
    isMatching: boolean;
    error?: string;
}

const PASSWORD_REQUIREMENTS: Omit<PasswordRequirement, 'met'>[] = [
    {
        label: "At least 10 characters",
        test: (password) => password.length >= 10,
    },
    {
        label: "Contains a letter",
        test: (password) => /[A-Za-z]/.test(password),
    },
    {
        label: "Contains a number",
        test: (password) => /\d/.test(password),
    },
    {
        label: "Contains a special character",
        test: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    },
];

export const usePasswordValidation = (password: string = "") => {
    const [isValidatingOnServer, setIsValidatingOnServer] = useState(false);
    const [serverValidationErrors, setServerValidationErrors] = useState<string[]>([]);

    // Client-side validation
    const clientValidation = useMemo((): PasswordValidationResult => {
        const requirements = PASSWORD_REQUIREMENTS.map((req) => ({
            ...req,
            met: req.test(password),
        }));

        const metCount = requirements.filter((req) => req.met).length;
        const strength = password.length === 0 ? 0 : metCount / requirements.length;

        const getStrengthText = (strength: number) => {
            if (strength === 0) return "Enter password";
            if (strength <= 0.25) return "Weak";
            if (strength <= 0.5) return "Fair";
            if (strength <= 0.75) return "Good";
            return "Strong";
        };

        const errors: string[] = [];
        requirements.forEach((req) => {
            if (!req.met && password.length > 0) {
                errors.push(req.label);
            }
        });

        return {
            isValid: strength === 1,
            strength,
            strengthText: getStrengthText(strength),
            requirements,
            errors,
        };
    }, [password]);

    // Server-side validation
    const validateOnServer = useCallback(async (passwordToValidate: string) => {
        if (!passwordToValidate || passwordToValidate.length === 0) {
            setServerValidationErrors([]);
            return { isValid: false, errors: [] };
        }

        setIsValidatingOnServer(true);
        setServerValidationErrors([]);

        try {
            const response = await apiClient.post<{ is_valid: boolean; errors: string[] }>(
                ENDPOINTS.AUTH.VALIDATE_PASSWORD,
                { password: passwordToValidate }
            );

            setServerValidationErrors(response.errors || []);
            
            logger.debug("Server password validation completed", {
                isValid: response.is_valid,
                errorCount: response.errors?.length || 0,
            });

            return {
                isValid: response.is_valid,
                errors: response.errors || [],
            };
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            logger.error("Server password validation failed", { error: errorMessage });
            
            // Fall back to client-side validation on server error
            setServerValidationErrors([]);
            return {
                isValid: clientValidation.isValid,
                errors: clientValidation.errors,
            };
        } finally {
            setIsValidatingOnServer(false);
        }
    }, [clientValidation.isValid, clientValidation.errors]);

    // Combined validation result
    const validation = useMemo((): PasswordValidationResult => {
        const allErrors = [...clientValidation.errors, ...serverValidationErrors];
        const uniqueErrors = Array.from(new Set(allErrors));

        return {
            ...clientValidation,
            isValid: clientValidation.isValid && serverValidationErrors.length === 0,
            errors: uniqueErrors,
        };
    }, [clientValidation, serverValidationErrors]);

    return {
        validation,
        isValidatingOnServer,
        validateOnServer,
        clearServerErrors: () => setServerValidationErrors([]),
    };
};

export const usePasswordConfirmation = (password: string = "", confirmPassword: string = "") => {
    const validation = useMemo((): PasswordConfirmationResult => {
        if (!confirmPassword || confirmPassword.length === 0) {
            return { isMatching: true }; // Don't show error for empty confirmation
        }

        const isMatching = password === confirmPassword;
        return {
            isMatching,
            error: isMatching ? undefined : "Passwords do not match",
        };
    }, [password, confirmPassword]);

    return validation;
};