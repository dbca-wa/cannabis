import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams, useLocation } from "react-router";
import { toast } from "sonner";
import { errorHandlingService, showSuccess } from "@/shared/services/errorHandling.service";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePasswordValidation, usePasswordConfirmation } from "@/features/auth/hooks/usePasswordValidation";
import {
	passwordUpdateSchema,
	type PasswordUpdateFormData,
} from "@/features/auth/schemas/password.schema";
import { PasswordStrengthIndicator } from "@/features/auth/components/PasswordStrengthIndicator";
import { PasswordConfirmationIndicator } from "@/features/auth/components/PasswordConfirmationIndicator";

import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import CannabisLogo from "@/shared/components/layout/CannabisLogo";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { apiClient, ENDPOINTS, type ApiError } from "@/shared/services/api";

const PasswordUpdate = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const { user, isAuthenticated } = useAuth();
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Check if this is a first-time password setup (from invitation or reset)
	const isFirstTime =
		searchParams.get("firstTime") === "true" ||
		searchParams.get("reset") === "true" ||
		location.state?.isFirstTime === true;

	// Check if coming from invitation activation
	const fromInvitation = location.state?.fromInvitation === true;
	const temporaryPassword = location.state?.temporaryPassword;

	const form = useForm<PasswordUpdateFormData>({
		resolver: zodResolver(passwordUpdateSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	const watchedNewPassword = form.watch("newPassword");
	const watchedCurrentPassword = form.watch("currentPassword");
	const watchedConfirmPassword = form.watch("confirmPassword");

	// Use validation hooks
	const { validation: passwordValidation, validateOnServer } = usePasswordValidation(watchedNewPassword);
	const confirmationValidation = usePasswordConfirmation(watchedNewPassword, watchedConfirmPassword);

	// Redirect if not authenticated
	useEffect(() => {
		if (!isAuthenticated) {
			logger.warn(
				"Unauthenticated user attempted to access password update page"
			);
			navigate("/auth/login");
		}
	}, [isAuthenticated, navigate]);

	// Clear current password error when user changes the current password
	useEffect(() => {
		if (watchedCurrentPassword && form.formState.errors.currentPassword) {
			form.clearErrors("currentPassword");
		}
	}, [watchedCurrentPassword, form]);

	// Validate password on server when it changes (debounced)
	useEffect(() => {
		if (watchedNewPassword && watchedNewPassword.length >= 3) {
			const timeoutId = setTimeout(() => {
				validateOnServer(watchedNewPassword);
			}, 500); // 500ms debounce

			return () => clearTimeout(timeoutId);
		}
	}, [watchedNewPassword, validateOnServer]);

	// Clear confirm password error when passwords match
	useEffect(() => {
		if (confirmationValidation.isMatching && form.formState.errors.confirmPassword) {
			form.clearErrors("confirmPassword");
		}
	}, [confirmationValidation.isMatching, form]);

	const onSubmit = async (values: PasswordUpdateFormData) => {
		if (!user) {
			errorHandlingService.handleError(new Error("User not found"), {
				action: "password_update",
				component: "PasswordUpdate"
			});
			return;
		}

		setIsSubmitting(true);
		logger.info("Password update form submitted", {
			userId: user.id,
			isFirstTime,
		});

		try {
			// Use proper API client with authentication
			await apiClient.post<{ message: string; password_last_changed: string }>(
				ENDPOINTS.AUTH.UPDATE_PASSWORD,
				{
					current_password: isFirstTime ? undefined : values.currentPassword,
					new_password: values.newPassword,
					confirm_password: values.confirmPassword,
					is_first_time: isFirstTime,
				}
			);

			logger.info("Password updated successfully", { userId: user.id });
			showSuccess("Password updated successfully!");

			// Navigate to home page after successful password update
			navigate("/");
		} catch (error) {
			// Use enhanced error handling
			const enhancedError = errorHandlingService.handleError(error, {
				action: "password_update",
				component: "PasswordUpdate",
				userId: user.id
			});

			// Handle API errors with specific field validation
			if (error && typeof error === 'object' && 'message' in error) {
				const apiError = error as ApiError;

				// Check if it's a current password error
				if (apiError.message === "Current password is incorrect") {
					form.setError("currentPassword", {
						type: "manual",
						message: "Current password is incorrect",
					});
				} else if (apiError.fieldErrors) {
					// Handle other field errors
					Object.entries(apiError.fieldErrors).forEach(([field, errors]) => {
						if (errors && errors.length > 0) {
							const fieldName = field === 'current_password' ? 'currentPassword' :
								field === 'new_password' ? 'newPassword' :
									field === 'confirm_password' ? 'confirmPassword' : field;
							form.setError(fieldName as keyof PasswordUpdateFormData, {
								type: "manual",
								message: errors[0],
							});
						}
					});
				}
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isAuthenticated || !user) {
		return null; // Will redirect in useEffect
	}

	return (
		<Card className="w-full max-w-xl md:min-w-lg lg:min-w-xl">
			<CardHeader>
				<CardTitle className="text-2xl text-center">
					<CannabisLogo shouldAnimate />
				</CardTitle>
				<div className="text-center">
					<h2 className="text-xl font-semibold">
						{isFirstTime ? "Set Your Password" : "Change Password"}
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						{fromInvitation
							? "Welcome! Please set a secure password to complete your account setup"
							: isFirstTime
								? "Please set a secure password for your account"
								: "Update your current password"}
					</p>
					{fromInvitation && temporaryPassword && (
						<div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
							<p><strong>Note:</strong> Your temporary password has been automatically set. Please create a new secure password below.</p>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						{/* Current password field - only show if not first time */}
						{!isFirstTime && (
							<FormField
								name="currentPassword"
								control={form.control}
								render={({ field }) => (
									<FormItem>
										<FormLabel>Current Password</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="password"
												placeholder="Enter current password"
												disabled={isSubmitting}
												autoComplete="current-password"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{/* New password field */}
						<FormField
							name="newPassword"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>New Password</FormLabel>
									<FormControl>
										<Input
											{...field}
											type="password"
											placeholder="Enter new password"
											disabled={isSubmitting}
											autoComplete="new-password"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Password strength indicator */}
						<PasswordStrengthIndicator
							password={watchedNewPassword}
							className="mt-2"
							showServerValidation={true}
						/>

						{/* Confirm password field */}
						<FormField
							name="confirmPassword"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm New Password</FormLabel>
									<FormControl>
										<Input
											{...field}
											type="password"
											placeholder="Confirm new password"
											disabled={isSubmitting}
											autoComplete="new-password"
										/>
									</FormControl>
									<FormMessage />
									{/* Password confirmation indicator */}
									<PasswordConfirmationIndicator
										password={watchedNewPassword}
										confirmPassword={watchedConfirmPassword}
										className="mt-1"
									/>
								</FormItem>
							)}
						/>

						<Button
							type="submit"
							className="w-full"
							variant="cannabis"
							disabled={
								isSubmitting ||
								!passwordValidation.isValid ||
								!confirmationValidation.isMatching ||
								(!isFirstTime && !watchedCurrentPassword)
							}
						>
							{isSubmitting
								? "Updating Password..."
								: isFirstTime
									? "Set Password"
									: "Update Password"}
						</Button>

						{/* Cancel button for non-first-time updates */}
						{!isFirstTime && (
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={() => navigate("/")}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
						)}
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

export default PasswordUpdate;
