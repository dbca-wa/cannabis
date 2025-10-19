import React from "react";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/shared/utils";

interface SearchErrorDisplayProps {
	error: Error | null;
	onRetry: () => void;
	isRetrying?: boolean;
	showFallbackData?: boolean;
	fallbackMessage?: string;
	className?: string;
	/**
	 * Type of error display
	 * - "initial": Error loading initial data (shows retry button)
	 * - "search": Error during search (shows error but keeps previous results)
	 * - "network": Network/offline error (shows offline indicator)
	 */
	type?: "initial" | "search" | "network";
}

/**
 * SearchErrorDisplay provides consistent error handling UI for search comboboxes
 * with retry functionality and fallback behavior
 */
export const SearchErrorDisplay: React.FC<SearchErrorDisplayProps> = ({
	error,
	onRetry,
	isRetrying = false,
	showFallbackData = false,
	fallbackMessage,
	className,
	type = "initial",
}) => {
	if (!error) return null;

	const getErrorMessage = () => {
		const message = error.message || "An error occurred";

		// Check for common error types
		if (message.includes("fetch") || message.includes("network")) {
			return "Network error. Please check your connection.";
		}
		if (message.includes("timeout")) {
			return "Request timed out. Please try again.";
		}
		if (message.includes("404")) {
			return "Service not found. Please try again later.";
		}
		if (message.includes("500")) {
			return "Server error. Please try again later.";
		}

		return "Failed to load data. Please try again.";
	};

	const getErrorIcon = () => {
		const message = error.message || "";

		if (message.includes("network") || message.includes("fetch")) {
			return <WifiOff className="h-4 w-4" />;
		}

		return <AlertCircle className="h-4 w-4" />;
	};

	// For search errors, show a more subtle error display
	if (type === "search") {
		return (
			<div
				className={cn(
					"p-2 border-l-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20",
					className
				)}
			>
				<div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
					{getErrorIcon()}
					<span>{getErrorMessage()}</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={onRetry}
						disabled={isRetrying}
						className="h-6 px-2 text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
					>
						{isRetrying ? (
							<RefreshCw className="h-3 w-3 animate-spin" />
						) : (
							<RefreshCw className="h-3 w-3" />
						)}
						<span className="ml-1">Retry</span>
					</Button>
				</div>
				{showFallbackData && fallbackMessage && (
					<div className="mt-1 text-xs text-orange-600 dark:text-orange-500">
						{fallbackMessage}
					</div>
				)}
			</div>
		);
	}

	// For network errors, show offline indicator
	if (type === "network") {
		return (
			<div className={cn("p-3 text-center", className)}>
				<div className="flex flex-col items-center gap-2">
					<WifiOff className="h-8 w-8 text-gray-400" />
					<div className="text-sm text-gray-600 dark:text-gray-400">
						You're offline
					</div>
					{showFallbackData && fallbackMessage && (
						<div className="text-xs text-gray-500 dark:text-gray-500">
							{fallbackMessage}
						</div>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={onRetry}
						disabled={isRetrying}
						className="mt-1"
					>
						{isRetrying ? (
							<RefreshCw className="h-3 w-3 animate-spin mr-2" />
						) : (
							<Wifi className="h-3 w-3 mr-2" />
						)}
						Try Again
					</Button>
				</div>
			</div>
		);
	}

	// Default initial data error display
	return (
		<div className={cn("p-3 text-center", className)}>
			<div className="flex flex-col items-center gap-2">
				{getErrorIcon()}
				<div className="text-sm text-red-600 dark:text-red-400">
					{getErrorMessage()}
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={onRetry}
					disabled={isRetrying}
					className="mt-1"
				>
					{isRetrying ? (
						<RefreshCw className="h-3 w-3 animate-spin mr-2" />
					) : (
						<RefreshCw className="h-3 w-3 mr-2" />
					)}
					Try Again
				</Button>
			</div>
		</div>
	);
};
