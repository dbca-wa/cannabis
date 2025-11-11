import { useNavigate, useLocation } from "react-router";
import { XCircle, RefreshCw, LogIn } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Head } from "@/shared/components/layout/Head";

export default function InviteActivationError() {
	const navigate = useNavigate();
	const location = useLocation();

	const error = location.state?.error || "An unknown error occurred";
	const token = location.state?.token;

	const handleRetry = () => {
		if (token) {
			navigate(`/auth/activate-invite/${token}`);
		}
	};

	const handleGoToLogin = () => {
		navigate("/auth/login");
	};

	const isRetryable =
		!error.toLowerCase().includes("expired") &&
		!error.toLowerCase().includes("used") &&
		!error.toLowerCase().includes("invalid") &&
		token;

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Head title="Activation Error" />
			<Card className="w-full max-w-md mx-auto">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<XCircle className="h-12 w-12 text-red-500" />
					</div>
					<CardTitle className="text-red-700">
						Invitation Activation Failed
					</CardTitle>
					<CardDescription>
						We couldn't activate your invitation.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<XCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>

					<div className="space-y-2">
						{isRetryable && (
							<Button
								onClick={handleRetry}
								variant="outline"
								className="w-full"
							>
								<RefreshCw className="h-4 w-4 mr-2" />
								Try Again
							</Button>
						)}

						<Button
							onClick={handleGoToLogin}
							variant="default"
							className="w-full"
						>
							<LogIn className="h-4 w-4 mr-2" />
							Go to Login
						</Button>
					</div>

					{/* Helpful guidance based on error type */}
					<div className="text-sm text-muted-foreground text-center">
						{error.toLowerCase().includes("expired") && (
							<p>
								This invitation has expired. Please contact your
								administrator for a new invitation.
							</p>
						)}
						{error.toLowerCase().includes("used") && (
							<p>
								This invitation has already been used. If you
								have an account, try logging in.
							</p>
						)}
						{error.toLowerCase().includes("invalid") && (
							<p>
								This invitation link appears to be invalid.
								Please check the link or contact your
								administrator.
							</p>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
