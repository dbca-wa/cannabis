import React from "react";
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
	errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	showDetails?: boolean;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.setState({ error, errorInfo });

		// Call the onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}

		// Log error to console in development
		if (import.meta.env.DEV) {
			console.error("ErrorBoundary caught an error:", error, errorInfo);
		}
	}

	handleRetry = () => {
		this.setState({
			hasError: false,
			error: undefined,
			errorInfo: undefined,
		});
	};

	handleGoHome = () => {
		window.location.href = "/";
	};

	render() {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default error UI
			return (
				<div className="min-h-[400px] flex items-center justify-center p-6">
					<div className="max-w-md w-full space-y-6">
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertTitle>Something went wrong</AlertTitle>
							<AlertDescription>
								{this.state.error?.message ||
									"An unexpected error occurred. Please try refreshing the page."}
							</AlertDescription>
						</Alert>

						<div className="flex flex-col sm:flex-row gap-3">
							<Button
								onClick={this.handleRetry}
								className="flex-1"
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								Try Again
							</Button>
							<Button
								variant="outline"
								onClick={this.handleGoHome}
								className="flex-1"
							>
								<Home className="mr-2 h-4 w-4" />
								Go Home
							</Button>
						</div>

						{/* Show error details in development */}
						{this.props.showDetails && import.meta.env.DEV && (
							<details className="mt-4">
								<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
									Error Details (Development)
								</summary>
								<pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto">
									{this.state.error?.stack}
								</pre>
								{this.state.errorInfo && (
									<pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto">
										{this.state.errorInfo.componentStack}
									</pre>
								)}
							</details>
						)}
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// Hook version for functional components
export function useErrorHandler() {
	const [error, setError] = React.useState<Error | null>(null);

	const resetError = React.useCallback(() => {
		setError(null);
	}, []);

	const handleError = React.useCallback((error: Error) => {
		setError(error);
	}, []);

	// Throw error to be caught by ErrorBoundary
	if (error) {
		throw error;
	}

	return { handleError, resetError };
}
