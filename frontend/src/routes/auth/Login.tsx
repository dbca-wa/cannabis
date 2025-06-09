import CannabisLogo from "@/components/layout/CannabisLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/features/auth/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLogin } from "@/hooks/tanstack/useLogin";
import { authService } from "@/api/authService";

const Login = () => {
	const VERSION = import.meta.env.VITE_CANNABIS_VERSION || "Unset";
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

	const [formVisible, setFormVisible] = useState(false);
	const [loginError, setLoginError] = useState<string | null>(null);

	const form = useForm<z.infer<typeof loginSchema>>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const { mutate, isPending } = useLogin();

	const onSubmit = (values: z.infer<typeof loginSchema>) => {
		setLoginError(null);
		mutate(values, {
			onError: (error: Error) => {
				setLoginError(error.message);
			},
		});
	};

	useEffect(() => {
		// Ensure CSRF token is available
		authService.ensureCSRFToken();

		const formTimer = setTimeout(() => {
			setFormVisible(true);
		}, 1600);

		return () => clearTimeout(formTimer);
	}, []);

	// Only show login form in development
	if (process.env.NODE_ENV !== "development") {
		return (
			<Card className="bg-card">
				<CardHeader>
					<CardTitle className="text-2xl text-center flex w-full justify-center">
						<CannabisLogo shouldAnimate />
					</CardTitle>
				</CardHeader>
				<CardContent className="text-center">
					<div className="text-lg mb-4">
						You will be automatically logged in via DBCA
						authentication.
					</div>
					<div className="text-sm text-muted-foreground">
						If you are not redirected automatically, please contact
						your system administrator.
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="bg-card">
			<CardHeader>
				<CardTitle className="text-2xl text-center flex w-full justify-center">
					<CannabisLogo shouldAnimate />
				</CardTitle>
			</CardHeader>
			<CardContent
				className={`transition-all duration-1000 ${
					formVisible
						? "opacity-100 translate-y-0"
						: "opacity-0 translate-y-4"
				}`}
			>
				<div className="text-center text-sm mb-4 text-muted-foreground">
					Development Mode - Use email/password to login
				</div>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						{loginError && (
							<div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
								{loginError}
							</div>
						)}

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
												type="email"
												placeholder="Enter email"
												disabled={isPending}
												required
												autoComplete="email"
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
												type="password"
												placeholder="Enter password"
												disabled={isPending}
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
							variant={"cannabis"}
							disabled={isPending}
						>
							{isPending ? "Logging in..." : "Login"}
						</Button>

						<div className="text-center text-sm">
							Cannabis version: {VERSION} ({ENVIRON})
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

export default Login;
