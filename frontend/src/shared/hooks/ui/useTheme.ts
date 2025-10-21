import { useEffect, useState, useCallback } from "react";
import { useLocalStorage } from "../core/useLocalStorage";
import { logger } from "@/shared/services/logger.service";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface UseThemeOptions {
	defaultTheme?: Theme;
	enableSystemTheme?: boolean;
	storageKey?: string;
}

export interface UseThemeReturn {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
	systemTheme: ResolvedTheme;
}

/**
 * Enhanced theme hook with system theme support and proper persistence
 * Integrates with localStorage service and provides better TypeScript support
 */
export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
	const {
		defaultTheme = "system",
		enableSystemTheme = true,
		storageKey = "theme",
	} = options;

	// Use localStorage hook for persistence
	const { value: storedTheme, setValue: setStoredTheme } = useLocalStorage<Theme>(
		storageKey,
		defaultTheme
	);

	// Track system theme preference
	const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
		if (typeof window === "undefined") return "light";
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	// Current theme state
	const [theme, setThemeState] = useState<Theme>(storedTheme);

	// Resolved theme (what actually gets applied)
	const resolvedTheme: ResolvedTheme =
		theme === "system" ? systemTheme : theme;

	// Listen for system theme changes
	useEffect(() => {
		if (!enableSystemTheme || typeof window === "undefined") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const handleChange = (e: MediaQueryListEvent) => {
			const newSystemTheme = e.matches ? "dark" : "light";
			setSystemTheme(newSystemTheme);
			
			logger.debug("System theme changed", {
				newSystemTheme,
				currentTheme: theme,
			});
		};

		// Set initial value
		setSystemTheme(mediaQuery.matches ? "dark" : "light");

		// Add listener
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
		} else {
			// Fallback for older browsers
			mediaQuery.addListener(handleChange);
		}

		// Cleanup
		return () => {
			if (mediaQuery.removeEventListener) {
				mediaQuery.removeEventListener("change", handleChange);
			} else {
				mediaQuery.removeListener(handleChange);
			}
		};
	}, [enableSystemTheme, theme]);

	// NOTE: Document theme application is disabled to avoid conflicts with UI Store
	// The UI Store (MobX) handles theme application to the document
	// This hook is only used for component-level theme detection
	useEffect(() => {
		if (typeof window === "undefined") return;

		logger.debug("useTheme hook - theme state (document application disabled)", {
			theme,
			resolvedTheme,
			systemTheme,
			note: "UI Store handles document theme application"
		});
	}, [resolvedTheme, theme, systemTheme]);

	// Set theme function
	const setTheme = useCallback(
		(newTheme: Theme) => {
			setThemeState(newTheme);
			setStoredTheme(newTheme);

			logger.debug("Theme changed", {
				previousTheme: theme,
				newTheme,
				resolvedTheme: newTheme === "system" ? systemTheme : newTheme,
			});
		},
		[setStoredTheme, theme, systemTheme]
	);

	// Toggle between light and dark (ignores system)
	const toggleTheme = useCallback(() => {
		const newTheme = resolvedTheme === "light" ? "dark" : "light";
		setTheme(newTheme);
	}, [resolvedTheme, setTheme]);

	return {
		theme,
		resolvedTheme,
		setTheme,
		toggleTheme,
		systemTheme,
	};
}
