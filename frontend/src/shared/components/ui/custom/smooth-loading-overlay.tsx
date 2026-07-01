import React from "react";
import { Loader2 } from "lucide-react";
import { SearchErrorDisplay } from "./search-error-display";
import { cn } from "@/shared/utils";

interface SmoothLoadingOverlayProps {
	isInitialLoading: boolean;
	isSearching: boolean;
	hasResults: boolean;
	children: React.ReactNode;
	skeletonCount?: number;
	className?: string;
	// Custom skeleton component to use instead of default
	customSkeleton?: React.ReactNode;
	// Skeleton type for search comboboxes (user, station, officer, simple)
	skeletonType?: "user" | "station" | "officer" | "simple";
	// Error handling props
	error?: Error | null;
	onRetry?: () => void;
	isRetrying?: boolean;
	// Fallback data when search fails
	hasFallbackData?: boolean;
	fallbackMessage?: string;
}

/**
 * Keeps the results container ("the box") stable while data loads so the
 * dropdown never collapses or remounts — only its contents change.
 *
 * It always renders a single wrapper of the same shape and renders `children`
 * inside it. While a request is in flight with nothing to show yet, a spinner
 * is layered on top rather than replacing the container. Paired with TanStack's
 * `keepPreviousData`, the previous results stay on screen and update in place,
 * eliminating the open/close flash on each keystroke.
 */
export const SmoothLoadingOverlay: React.FC<SmoothLoadingOverlayProps> = ({
	isInitialLoading,
	isSearching,
	hasResults,
	children,
	skeletonCount: _skeletonCount = 4,
	className,
	customSkeleton: _customSkeleton,
	skeletonType: _skeletonType,
	error,
	onRetry,
	isRetrying = false,
	hasFallbackData = false,
	fallbackMessage,
}) => {
	// Initial-load error with no data to fall back to — offer a retry
	if (error && !hasResults && !hasFallbackData && onRetry) {
		const errorType =
			error.message?.includes("network") || error.message?.includes("fetch")
				? "network"
				: "initial";

		return (
			<div className={cn("min-h-[120px]", className)}>
				<SearchErrorDisplay
					error={error}
					onRetry={onRetry}
					isRetrying={isRetrying}
					type={errorType}
					showFallbackData={hasFallbackData}
					fallbackMessage={fallbackMessage}
				/>
			</div>
		);
	}

	// Only overlay a spinner when there is genuinely nothing to show yet.
	// During a keystroke refetch the previous results remain (keepPreviousData),
	// so the list stays visible and just updates in place.
	const showSpinner = (isInitialLoading || isSearching) && !hasResults;

	return (
		<div className={cn("relative min-h-[120px]", className)}>
			{children}
			{showSpinner && (
				<div
					className="absolute inset-0 flex items-center justify-center bg-popover/60"
					role="status"
					aria-live="polite"
				>
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					<span className="sr-only">Loading results…</span>
				</div>
			)}
		</div>
	);
};
