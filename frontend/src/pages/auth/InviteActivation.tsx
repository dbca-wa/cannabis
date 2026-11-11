import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Loader2, XCircle, MailCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
	activateInvitation,
	getInvitation,
} from "@/features/auth/services/auth.service";
import { logger } from "@/shared/services/logger.service";
import { formatDate } from "@/shared/utils/date.utils";
import { getErrorMessage } from "@/shared/utils/error.utils";
import type { InviteDetails } from "@/shared/types/backend-api.types";

type PageState =
	| { status: "checking" }
	| { status: "ready"; invite: InviteDetails }
	| { status: "accepting"; invite: InviteDetails }
	| { status: "error"; error: string };

const errorText = (error: unknown, fallback: string) => {
	const message = getErrorMessage(error);
	return message && message !== "An unknown error occurred"
		? message
		: fallback;
};

/** An invitation that cannot be used at all, shown on its own error page. */
const isDeadInvitation = (message: string) => {
	const lower = message.toLowerCase();
	return (
		lower.includes("expired") ||
		lower.includes("used") ||
		lower.includes("invalid")
	);
};

/**
 * The page an invitation email links to.
 *
 * Opening the link only checks the invitation and shows who it is for; the
 * account is created when the person clicks "Set Up Password Now". So
 * reloading the page, or a mail scanner opening the link, never uses the
 * invitation up.
 */
const InviteActivation = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const [state, setState] = useState<PageState>({ status: "checking" });

	const goToErrorPage = useCallback(
		(message: string, inviteToken: string) =>
			navigate("/auth/invite-error", {
				replace: true,
				state: { error: message, token: inviteToken },
			}),
		[navigate]
	);

	const checkInvitation = useCallback(
		async (inviteToken: string) => {
			try {
				const invite = await getInvitation(inviteToken);
				setState({ status: "ready", invite });
			} catch (error) {
				logger.error("Failed to check invitation", { error });
				const message = errorText(
					error,
					"We could not check this invitation. Please try again."
				);
				if (isDeadInvitation(message)) {
					goToErrorPage(message, inviteToken);
					return;
				}
				setState({ status: "error", error: message });
			}
		},
		[goToErrorPage]
	);

	useEffect(() => {
		if (!token) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setState({
				status: "error",
				error: "Invalid invitation link - no token provided",
			});
			return;
		}
		void checkInvitation(token);
	}, [token, checkInvitation]);

	const handleAccept = async () => {
		if (!token || state.status !== "ready") return;
		setState({ status: "accepting", invite: state.invite });
		try {
			await activateInvitation(token);
			logger.info("Invitation accepted", {
				token: token.substring(0, 8) + "...",
			});
			// A full load, so the app starts with the new session.
			window.location.href = "/auth/password-update?fromReset=true";
		} catch (error) {
			logger.error("Failed to accept invitation", { error });
			const message = errorText(
				error,
				"We could not set up your account. Please try again."
			);
			if (isDeadInvitation(message)) {
				goToErrorPage(message, token);
				return;
			}
			setState({ status: "error", error: message });
		}
	};

	const handleRetry = () => {
		if (!token) return;
		setState({ status: "checking" });
		void checkInvitation(token);
	};

	const renderContent = () => {
		switch (state.status) {
			case "checking":
				return (
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4" role="status">
								<Loader2
									className="h-12 w-12 animate-spin text-emerald-600"
									aria-hidden="true"
								/>
								<span className="sr-only">Checking your invitation</span>
							</div>
							<CardTitle>Checking Your Invitation</CardTitle>
							<CardDescription>Just a moment...</CardDescription>
						</CardHeader>
					</Card>
				);

			case "ready":
			case "accepting": {
				const { invite } = state;
				const name = [invite.given_names, invite.last_name]
					.filter(Boolean)
					.join(" ");
				const accepting = state.status === "accepting";
				return (
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4">
								<MailCheck
									className="h-12 w-12 text-emerald-500"
									aria-hidden="true"
								/>
							</div>
							<CardTitle className="text-emerald-700 dark:text-emerald-400">
								You&apos;re invited to the Cannabis Management System
							</CardTitle>
							<CardDescription>
								{invite.invited_by
									? `${invite.invited_by} has invited you to join.`
									: "You have been invited to join."}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
								{name && (
									<>
										<dt className="text-muted-foreground">Name</dt>
										<dd className="font-medium">{name}</dd>
									</>
								)}
								<dt className="text-muted-foreground">Email</dt>
								<dd className="font-medium break-all">{invite.email}</dd>
								<dt className="text-muted-foreground">Role</dt>
								<dd className="font-medium">{invite.role_display}</dd>
								<dt className="text-muted-foreground">Expires</dt>
								<dd className="font-medium">{formatDate(invite.expires_at)}</dd>
							</dl>
							<p className="text-sm text-muted-foreground">
								Your account is created when you continue. You will then choose
								your password.
							</p>
							<Button
								onClick={handleAccept}
								disabled={accepting}
								className="w-full"
							>
								{accepting && (
									<Loader2
										className="mr-2 h-4 w-4 animate-spin"
										aria-hidden="true"
									/>
								)}
								{accepting
									? "Setting up your account..."
									: "Set Up Password Now"}
							</Button>
						</CardContent>
					</Card>
				);
			}

			case "error":
				return (
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4">
								<XCircle
									className="h-12 w-12 text-destructive"
									aria-hidden="true"
								/>
							</div>
							<CardTitle className="text-destructive">
								Invitation Activation Failed
							</CardTitle>
							<CardDescription>
								We couldn&apos;t activate your invitation.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert variant="destructive">
								<XCircle className="h-4 w-4" aria-hidden="true" />
								<AlertDescription>{state.error}</AlertDescription>
							</Alert>
							<div className="space-y-2">
								{token && (
									<Button
										onClick={handleRetry}
										variant="outline"
										className="w-full"
									>
										Try Again
									</Button>
								)}
								<Button
									onClick={() => navigate("/auth/login")}
									variant="default"
									className="w-full"
								>
									Go to Login
								</Button>
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
