import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router";
import { useAuthStore, useUIStore } from "@/stores/rootStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Login = observer(() => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const navigate = useNavigate();
	const authStore = useAuthStore();
	const uiStore = useUIStore();

	// Set page metadata when the component mounts
	useEffect(() => {
		uiStore.setPageMetadata({
			title: "Login",
			description: "Sign in to your account",
		});
	}, [uiStore]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const success = await authStore.login({ username, password });
		if (success) {
			navigate("/");
		}
	};

	return (
		<Card className="">
			<CardHeader>
				<CardTitle className="text-2xl text-center">Login</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					{authStore.error && (
						<Alert variant="destructive">
							<AlertDescription>
								{authStore.error}
							</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="username">Username</Label>
						<Input
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						variant={"cannabis"}
						disabled={authStore.loading}
					>
						{authStore.loading ? "Logging in..." : "Login"}
					</Button>

					<div className="text-center text-sm">
						Don't have an account?{" "}
						<a
							href="/auth/register"
							className="text-blue-600 hover:underline"
						>
							Register
						</a>
					</div>
				</form>
			</CardContent>
		</Card>
	);
});

export default Login;
