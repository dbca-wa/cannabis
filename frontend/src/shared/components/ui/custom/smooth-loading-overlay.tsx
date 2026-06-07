import React, { useRef, useEffect, useState } from "react";
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
 * SmoothLoadingOverlay prevents visual flashing by:
 * 1. Maintaining consistent dimensions to prevent size changes
 * 2. Showing skeleton on initial load when no data exists
 * 3. Showing overlay with previous results when searching
 * 4. Smooth transitions between states without layout shifts
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
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [previousChildren, setPreviousChildren] =
		useState<React.ReactNode>(null);

	// Store previous children when we have results to maintain content during loading
	useEffect(() => {
		if (hasResults && !isSearching) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPreviousChildren(children);
		}
	}, [hasResults, isSearching, children]);

	// Measure and store dimensions when content is stable
	useEffect(() => {
		if (containerRef.current && hasResults && !isSearching) {
			const rect = containerRef.current.getBoundingClientRect();

			setDimensions({
				width: rect.width,
				height: rect.height,
			});
		}
	}, [hasResults, isSearching]);

	// Show error for initial data loading failures
	if (error && !hasResults && !hasFallbackData && onRetry) {
		const errorType =
			error.message?.includes("network") || error.message?.includes("fetch")
				? "network"
				: "initial";

		return (
			<div
				ref={containerRef}
				className={cn("transition-opacity duration-200", className)}
				style={
					dimensions
						? {
								width: dimensions.width,
								minHeight: Math.max(dimensions.height, 120),
							}
						: { minHeight: 120 }
				}
			>
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

	// Show skeleton when initially loading and no results yet
	if (isInitialLoading && !hasResults) {
		return null;
	}

	// When searching with no results and no previous content to show
	if (isSearching && !hasResults && !previousChildren) {
		return null;
	}

	// Normal state - show content and measure dimensions
	return (
		<div
			ref={containerRef}
			className={cn("transition-opacity duration-200", className)}
			style={
				dimensions
					? { width: dimensions.width, minHeight: dimensions.height }
					: undefined
			}
		>
			{children}
		</div>
	);
};
