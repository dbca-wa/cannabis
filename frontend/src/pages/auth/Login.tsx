import { useAuth } from "@/features/auth/hooks/useAuth";
import { loginSchema } from "@/features/auth/schemas/login.schema";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { logger } from "@/shared/services/logger.service";
import * as z from "zod";

const Login = () => {
	const VERSION = import.meta.env.VITE_APP_VERSION || "Unset";
	const VITE_PRODUCTION_BACKEND_API_URL = import.meta.env
		.VITE_PRODUCTION_BACKEND_API_URL;

	let ENVIRON = "";
	if (VITE_PRODUCTION_BACKEND_API_URL?.includes("test")) {
		ENVIRON = "TEST";
	} else if (VITE_PRODUCTION_BACKEND_API_URL?.includes("prod")) {
		ENVIRON = "PROD";
	} else {
		ENVIRON = "LOCAL";
	}

	const { login, isLoggingIn, loginError, user, isAuthenticated, isLoading } =
		useAuth();

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
			logger.info(
				"User authenticated, navigation handled by auth store",
				{
					userId: user.id,
					email: user.email,
				}
			);
		}
	}, [isAuthenticated, user]);

	const onSubmit = async (values: z.infer<typeof loginSchema>) => {
		logger.info("Login form submitted", { email: values.email });

		try {
			// login method handles navigation internally
			login(values);
		} catch (error) {
			logger.error("Login submission failed", {
				error: getErrorMessage(error),
			});
		}
	};

	// Show loading while checking authentication
	if (isLoading) {
		return (
			<Card className="bg-card">
				<CardHeader>
					<CardTitle className="text-2xl text-center">
						<CannabisLogo shouldAnimate />
					</CardTitle>
				</CardHeader>
				<CardContent className="text-center">
					<div className="text-lg mb-4">
						Checking authentication...
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="bg-card">
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
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						{loginError ? (
							<div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-200">
								{(() => getErrorMessage(loginError))()}
							</div>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<FormField
								name="email"
								control={form.control}
								render={({ field }: { field: any }) => (
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
								render={({ field }: { field: any }) => (
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
		</Card>
	);
};

export default Login;
