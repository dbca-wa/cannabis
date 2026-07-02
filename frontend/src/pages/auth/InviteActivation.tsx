import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { activateInvitation as activateInvitationService } from "@/features/auth/services/auth.service";
import { logger } from "@/shared/services/logger.service";

interface ActivationResponse {
	message: string;
	user: {
		id: number;
		email: string;
		full_name: string;
		role: string;
	};
	tokens: {
		access: string;
		refresh: string;
		token_type: string;
		expires_in: number;
	};
	temporary_password: string;
	requires_password_change: boolean;
}

type ActivationState =
	| { status: "loading" }
	| { status: "success"; data: ActivationResponse }
	| { status: "error"; error: string };

const InviteActivation = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const [activationState, setActivationState] = useState<ActivationState>({
		status: "loading",
	});

	const activateInvitation = useCallback(
		async (inviteToken: string) => {
			try {
				logger.info("Activating invitation", {
					token: inviteToken.substring(0, 8) + "...",
				});

				const result = await activateInvitationService(inviteToken);

				const data: ActivationResponse = {
					message: "Invitation activated successfully",
					user: result.user,
					tokens: {
						access: result.access,
						refresh: result.refresh,
						token_type: result.token_type || "Bearer",
						expires_in: result.expires_in || 3600,
					},
					temporary_password: result.temporary_password,
					requires_password_change: result.requires_password_change,
				};

				logger.info("Invitation activated successfully", {
					userId: data.user.id,
					email: data.user.email,
				});

				setActivationState({ status: "success", data });

				// Auto-redirect to password update after a short delay
				setTimeout(() => {
					window.location.href = "/auth/password-update?fromReset=true";
				}, 2000);
			} catch (error) {
				logger.error("Failed to activate invitation", { error });

				const errorMessage =
					error instanceof Error
						? error.message
						: "An unexpected error occurred while activating your invitation";

				// For certain errors, redirect to error page with more context
				if (
					errorMessage.toLowerCase().includes("expired") ||
					errorMessage.toLowerCase().includes("used") ||
					errorMessage.toLowerCase().includes("invalid")
				) {
					navigate("/auth/invite-error", {
						replace: true,
						state: { error: errorMessage, token: inviteToken },
					});
					return;
				}

				setActivationState({ status: "error", error: errorMessage });
			}
		},
		[navigate]
	);

	useEffect(() => {
		if (!token) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActivationState({
				status: "error",
				error: "Invalid invitation link - no token provided",
			});
			return;
		}

		activateInvitation(token);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token]);

	const handleRetryActivation = () => {
		if (token) {
			setActivationState({ status: "loading" });
			activateInvitation(token);
		}
	};

	const handleGoToLogin = () => {
		navigate("/auth/login");
	};

	const renderContent = () => {
		switch (activationState.status) {
			case "loading":
				return (
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4">
								<Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
							</div>
							<CardTitle>Activating Your Invitation</CardTitle>
							<CardDescription>
								Please wait while we set up your account...
							</CardDescription>
						</CardHeader>
					</Card>
				);

			case "success":
				return (
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4">
								<CheckCircle className="h-12 w-12 text-emerald-500" />
							</div>
							<CardTitle className="text-emerald-700 dark:text-emerald-400">
								Welcome to Cannabis Management System!
							</CardTitle>
							<CardDescription>
								Your account has been successfully activated.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert>
								<AlertTriangle className="h-4 w-4" />
								<AlertDescription>
									You'll be redirected to set up your password in a moment.
									Please keep your temporary password safe until then.
								</AlertDescription>
							</Alert>

							<div className="text-center">
								<p className="text-sm text-muted-foreground mb-4">
									Welcome,{" "}
									<strong>{activationState.data.user.full_name}</strong>
									!<br />
									Role: <strong>{activationState.data.user.role}</strong>
								</p>

								<Button
									onClick={() => {
										window.location.href =
											"/auth/password-update?fromReset=true";
									}}
									className="w-full"
								>
									Set Up Password Now
								</Button>
							</div>
						</CardContent>
					</Card>
				);

			case "error":
				return (
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4">
								<XCircle className="h-12 w-12 text-destructive" />
							</div>
							<CardTitle className="text-destructive">
								Invitation Activation Failed
							</CardTitle>
							<CardDescription>
								We couldn't activate your invitation.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert variant="destructive">
								<XCircle className="h-4 w-4" />
								<AlertDescription>{activationState.error}</AlertDescription>
							</Alert>

							<div className="space-y-2">
								{/* Show retry button for certain types of errors */}
								{!activationState.error.toLowerCase().includes("expired") &&
									!activationState.error.toLowerCase().includes("used") && (
										<Button
											onClick={handleRetryActivation}
											variant="outline"
											className="w-full"
										>
											Try Again
										</Button>
									)}

								<Button
									onClick={handleGoToLogin}
									variant="default"
									className="w-full"
								>
									Go to Login
								</Button>
							</div>

							{/* Helpful guidance based on error type */}
							<div className="text-sm text-muted-foreground text-center">
								{activationState.error.toLowerCase().includes("expired") && (
									<p>
										This invitation has expired. Please contact your
										administrator for a new invitation.
									</p>
								)}
								{activationState.error.toLowerCase().includes("used") && (
									<p>
										This invitation has already been used. If you have an
										account, try logging in.
									</p>
								)}
								{activationState.error.toLowerCase().includes("invalid") && (
									<p>
										This invitation link appears to be invalid. Please check the
										link or contact your administrator.
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				);

			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			{renderContent()}
		</div>
	);
};

export default InviteActivation;
