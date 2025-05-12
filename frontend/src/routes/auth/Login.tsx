import CannabisLogo from "@/components/layout/CannabisLogo";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useAuthStore } from "@/stores/rootStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLogin } from "./hooks/useLogin";

const Login = () => {
	// const [username, setUsername] = useState("");
	// const [password, setPassword] = useState("");
	const [formVisible, setFormVisible] = useState(false);
	const authStore = useAuthStore();

	const form = useForm<z.infer<typeof loginSchema>>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const { mutate, isPending } = useLogin();

	const onSubmit = (values: z.infer<typeof loginSchema>) => {
		// console.log(values);
		mutate(values);
	};

	// Set page metadata when the component mounts
	useEffect(() => {
		// Wait for logo animation to complete before showing the form
		// The logo takes about 600ms to start + 1000ms to animate = 1600ms total
		const formTimer = setTimeout(() => {
			setFormVisible(true);
		}, 1600);

		return () => clearTimeout(formTimer);
	}, []);

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
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						{authStore.error && (
							<Alert variant="destructive">
								<AlertDescription>
									{authStore.error}
								</AlertDescription>
							</Alert>
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
												autoComplete="off"
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
							Don't have an account?{" "}
							<a
								href="/auth/register"
								className="cannabis-green hover:underline"
							>
								Register
							</a>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

export default Login;
