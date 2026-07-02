import { useAuth } from "@/features/auth/hooks/useAuth";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import CannabisLogo from "@/shared/components/layout/CannabisLogo";
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
	FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { logger } from "@/shared/services/logger.service";
import { getAppVersion, getAppEnvironment } from "@/shared/utils/version.utils";
import * as z from "zod";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

const Login = () => {
	useDocumentTitle("Login");

	const VERSION = getAppVersion();
	const ENVIRON = getAppEnvironment();

	const { login, isLoggingIn, loginError, user, isAuthenticated, isLoading } =
		useAuth();

	const [showForgotPassword, setShowForgotPassword] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();

	// Check if we should show forgot password modal from navigation state
	useEffect(() => {
		if (location.state?.showForgotPassword) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setShowForgotPassword(true);
		}
	}, [location.state]);

	const form = useForm<z.infer<typeof loginSchema>>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
		// FOR DEBUG
		// defaultValues: {
		// 	email: "test@dbca.wa.gov.au",
		// 	password: "testpass123",
		// },
	});

	// Log when user is authenticated
	useEffect(() => {
		if (isAuthenticated && user && user.id) {
			logger.info("User already authenticated, redirecting to dashboard", {
				userId: user.id,
				email: user.email,
			});
			navigate("/");
		}
	}, [isAuthenticated, user, navigate]);

	const onSubmit = async (values: z.infer<typeof loginSchema>) => {
		logger.info("Login form submitted", { email: values.email });

		try {
			// login method handles navigation internally
			login(values);
		} catch (error) {
			logger.error("Login case failed", {
				error: getErrorMessage(error),
			});
		}
	};

	// Show loading only if we're actually checking authentication and not already determined to be unauthenticated
	if (isLoading && !loginError) {
		return (
			<>
				<Card className="bg-card">
					<CardHeader>
						<CardTitle className="text-2xl text-center">
							<CannabisLogo shouldAnimate />
						</CardTitle>
					</CardHeader>
					<CardContent className="text-center">
						<div className="text-lg mb-4">Loading...</div>
					</CardContent>
				</Card>
			</>
		);
	}

	return (
		<Card className="w-full max-w-md mx-auto bg-card border-none">
			<CardHeader>
				<CardTitle className="text-2xl text-center">
					<CannabisLogo shouldAnimate />
				</CardTitle>
			</CardHeader>
			<CardContent className={`transition-all duration-1000 opacity-100`}>
				<div className="text-center text-sm mb-4 text-muted-foreground">
					Use email/password to login
				</div>

				{/* <div className="text-center text-xs mb-4 p-2 bg-orange-500 rounded border">
					<strong>Test Credentials:</strong>
					<br />
					Email: test@dbca.wa.gov.au
					<br />
					Password: testpass123
				</div> */}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{loginError ? (
							<div
								role="alert"
								className="text-destructive text-sm text-center bg-destructive/10 p-2 rounded-lg border border-destructive/20"
							>
								{(() => getErrorMessage(loginError))()}
							</div>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<FormField
								name="email"
								control={form.control}
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												{...field}
												id="email"
												type="email"
												placeholder="Enter email"
												disabled={isLoggingIn}
												required
												autoComplete="email"
												className=""
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<FormField
								name="password"
								control={form.control}
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												{...field}
												id="password"
												type="password"
												placeholder="Enter password"
												disabled={isLoggingIn}
												autoComplete="current-password"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<Button
							type="submit"
							className="w-full"
							variant="cannabis"
							disabled={isLoggingIn}
						>
							{isLoggingIn ? "Logging in..." : "Login"}
						</Button>

						{/* Forgot Password Link */}
						<div className="text-center">
							<button
								type="button"
								onClick={() => setShowForgotPassword(true)}
								className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline cursor-pointer"
								disabled={isLoggingIn}
							>
								Forgot your password?
							</button>
						</div>

						<div className="text-xs text-muted-foreground text-center space-y-1">
							<div>
								Cannabis version: {VERSION} ({ENVIRON})
							</div>
							{/* <div>
								Status:{" "}
								{isAuthenticated
									? "Authenticated"
									: "Not authenticated"}
								{user && user.email && ` (${user.email})`}
							</div> */}
						</div>
					</form>
				</Form>
			</CardContent>

			{/* Forgot Password Modal */}
			<Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="sr-only">Reset Password</DialogTitle>
					</DialogHeader>
					<ForgotPasswordForm
						onSuccess={() => setShowForgotPassword(false)}
						onCancel={() => setShowForgotPassword(false)}
					/>
				</DialogContent>
			</Dialog>
		</Card>
	);
};

export default Login;
