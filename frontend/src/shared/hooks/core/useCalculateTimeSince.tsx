import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/shared/services/logger.service";

export type DateInput = Date | string | number | null | undefined;

export interface UseTimeSinceOptions {
	updateInterval?: number;
	format?: "relative" | "short" | "long";
	showSeconds?: boolean;
	fallbackText?: string;
}

export interface UseTimeSinceReturn {
	timeString: string;
	isValid: boolean;
	refresh: () => void;
}

/**
 * Enhanced hook for calculating and formatting time since a given date
 * Provides better error handling, TypeScript support, and formatting options
 */
export function useTimeSince(
	date: DateInput,
	options: UseTimeSinceOptions = {}
): UseTimeSinceReturn {
	const {
		updateInterval = 60000, // 1 minute
		format = "relative",
		showSeconds = false,
		fallbackText = "Unknown date",
	} = options;

	const [timeString, setTimeString] = useState<string>("");
	const [isValid, setIsValid] = useState<boolean>(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const calculateTimeElapsed = useCallback((): string => {
		if (!date) {
			setIsValid(false);
			return "";
		}

		try {
			let dateObj: Date;

			// Handle different input types
			if (date instanceof Date) {
				dateObj = date;
			} else if (typeof date === "number") {
				dateObj = new Date(date);
			} else if (typeof date === "string") {
				// Handle ISO strings and other date formats
				dateObj = new Date(date);
			} else {
				setIsValid(false);
				return fallbackText;
			}

			// Check if date is valid
			if (isNaN(dateObj.getTime())) {
				setIsValid(false);
				logger.warn("Invalid date provided to useTimeSince", { date });
				return fallbackText;
			}

			setIsValid(true);

			const now = new Date();
			const diffInSeconds = Math.floor(
				(now.getTime() - dateObj.getTime()) / 1000
			);

			// Handle future dates
			if (diffInSeconds < 0) {
				return format === "short" ? "future" : "in the future";
			}

			// Format based on options
			return formatTimeDifference(diffInSeconds, format, showSeconds);
		} catch (error) {
			setIsValid(false);
			logger.error("Error calculating time since", { error, date });
			return fallbackText;
		}
	}, [date, format, showSeconds, fallbackText]);

	const refresh = useCallback(() => {
		const newTimeString = calculateTimeElapsed();
		setTimeString(newTimeString);
	}, [calculateTimeElapsed]);

	useEffect(() => {
		// Set initial value
		refresh();

		// Clear existing interval
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
		}

		// Set up update interval if date is valid and recent
		if (isValid && updateInterval > 0) {
			intervalRef.current = setInterval(refresh, updateInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [refresh, isValid, updateInterval]);

	return {
		timeString,
		isValid,
		refresh,
	};
}

/**
 * Format time difference based on format option
 */
function formatTimeDifference(
	diffInSeconds: number,
	format: "relative" | "short" | "long",
	showSeconds: boolean
): string {
	// Within 30 seconds
	if (diffInSeconds < 30) {
		return format === "short" ? "now" : "just now";
	}

	// Seconds (if enabled)
	if (showSeconds && diffInSeconds < 60) {
		const seconds = diffInSeconds;
		switch (format) {
			case "short":
				return `${seconds}s`;
			case "long":
				return `${seconds} ${seconds === 1 ? "second" : "seconds"} ago`;
			default:
				return `${seconds} seconds ago`;
		}
	}

	// Minutes
	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) {
		switch (format) {
			case "short":
				return `${diffInMinutes}m`;
			case "long":
				return `${diffInMinutes} ${
					diffInMinutes === 1 ? "minute" : "minutes"
				} ago`;
			default:
				return `${diffInMinutes} ${
					diffInMinutes === 1 ? "minute" : "minutes"
				} ago`;
		}
	}

	// Hours
	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) {
		switch (format) {
			case "short":
				return `${diffInHours}h`;
			case "long":
				return `${diffInHours} ${
					diffInHours === 1 ? "hour" : "hours"
				} ago`;
			default:
				return `${diffInHours} ${
					diffInHours === 1 ? "hour" : "hours"
				} ago`;
		}
	}

	// Days
	const diffInDays = Math.floor(diffInHours / 24);
	if (diffInDays < 7) {
		switch (format) {
			case "short":
				return `${diffInDays}d`;
			case "long":
				return `${diffInDays} ${
					diffInDays === 1 ? "day" : "days"
				} ago`;
			default:
				return `${diffInDays} ${
					diffInDays === 1 ? "day" : "days"
				} ago`;
		}
	}

	// Weeks
	const diffInWeeks = Math.floor(diffInDays / 7);
	if (diffInWeeks < 5) {
		switch (format) {
			case "short":
				return `${diffInWeeks}w`;
			case "long":
				return `${diffInWeeks} ${
					diffInWeeks === 1 ? "week" : "weeks"
				} ago`;
			default:
				return `${diffInWeeks} ${
					diffInWeeks === 1 ? "week" : "weeks"
				} ago`;
		}
	}

	// Months
	const diffInMonths = Math.floor(diffInDays / 30);
	if (diffInMonths < 12) {
		switch (format) {
			case "short":
				return `${diffInMonths}mo`;
			case "long":
				return `${diffInMonths} ${
					diffInMonths === 1 ? "month" : "months"
				} ago`;
			default:
				return `${diffInMonths} ${
					diffInMonths === 1 ? "month" : "months"
				} ago`;
		}
	}

	// Years
	const diffInYears = Math.floor(diffInDays / 365);
	switch (format) {
		case "short":
			return `${diffInYears}y`;
		case "long":
			return `${diffInYears} ${
				diffInYears === 1 ? "year" : "years"
			} ago`;
		default:
			return `${diffInYears} ${
				diffInYears === 1 ? "year" : "years"
			} ago`;
	}
}

// Backward compatibility export
export default function useCalculateTimeSince(date?: DateInput): string {
	const { timeString } = useTimeSince(date);
	return timeString;
}
