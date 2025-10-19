import { useState, useEffect } from "react";

// Breakpoint definitions matching Tailwind CSS
const breakpoints = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	"2xl": 1536,
} as const;

type Breakpoint = keyof typeof breakpoints;

// Hook to check if screen is above a certain breakpoint
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(query);

		// Set initial value
		setMatches(media.matches);

		// Create listener
		const listener = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		// Add listener
		if (media.addEventListener) {
			media.addEventListener("change", listener);
		} else {
			// Fallback for older browsers
			media.addListener(listener);
		}

		// Cleanup
		return () => {
			if (media.removeEventListener) {
				media.removeEventListener("change", listener);
			} else {
				media.removeListener(listener);
			}
		};
	}, [query]);

	return matches;
}

// Hook to get current screen size category
export function useScreenSize() {
	const [screenSize, setScreenSize] = useState<Breakpoint | "xs">("xs");

	useEffect(() => {
		const updateScreenSize = () => {
			const width = window.innerWidth;

			if (width >= breakpoints["2xl"]) {
				setScreenSize("2xl");
			} else if (width >= breakpoints.xl) {
				setScreenSize("xl");
			} else if (width >= breakpoints.lg) {
				setScreenSize("lg");
			} else if (width >= breakpoints.md) {
				setScreenSize("md");
			} else if (width >= breakpoints.sm) {
				setScreenSize("sm");
			} else {
				setScreenSize("xs");
			}
		};

		// Set initial value
		updateScreenSize();

		// Add listener
		window.addEventListener("resize", updateScreenSize);

		// Cleanup
		return () => window.removeEventListener("resize", updateScreenSize);
	}, []);

	return screenSize;
}

// Hook for responsive breakpoint checks
export function useBreakpoint() {
	const isSm = useMediaQuery(`(min-width: ${breakpoints.sm}px)`);
	const isMd = useMediaQuery(`(min-width: ${breakpoints.md}px)`);
	const isLg = useMediaQuery(`(min-width: ${breakpoints.lg}px)`);
	const isXl = useMediaQuery(`(min-width: ${breakpoints.xl}px)`);
	const is2Xl = useMediaQuery(`(min-width: ${breakpoints["2xl"]}px)`);

	return {
		isSm,
		isMd,
		isLg,
		isXl,
		is2Xl,
		// Convenience properties
		isMobile: !isSm,
		isTablet: isSm && !isLg,
		isDesktop: isLg,
	};
}

// Hook for responsive values
export function useResponsiveValue<T>(values: {
	xs?: T;
	sm?: T;
	md?: T;
	lg?: T;
	xl?: T;
	"2xl"?: T;
}): T | undefined {
	const screenSize = useScreenSize();

	// Return the value for current screen size or fallback to smaller sizes
	if (screenSize === "2xl" && values["2xl"]) return values["2xl"];
	if ((screenSize === "2xl" || screenSize === "xl") && values.xl)
		return values.xl;
	if (
		(screenSize === "2xl" || screenSize === "xl" || screenSize === "lg") &&
		values.lg
	)
		return values.lg;
	if (screenSize !== "xs" && values.md) return values.md;
	if (screenSize !== "xs" && values.sm) return values.sm;
	return values.xs;
}

// Hook for responsive table columns
export function useResponsiveColumns<T>(
	allColumns: T[],
	responsiveConfig: {
		xs?: number;
		sm?: number;
		md?: number;
		lg?: number;
		xl?: number;
		"2xl"?: number;
	}
): T[] {
	const screenSize = useScreenSize();

	const getColumnCount = () => {
		switch (screenSize) {
			case "2xl":
				return (
					responsiveConfig["2xl"] ||
					responsiveConfig.xl ||
					responsiveConfig.lg ||
					allColumns.length
				);
			case "xl":
				return (
					responsiveConfig.xl ||
					responsiveConfig.lg ||
					allColumns.length
				);
			case "lg":
				return responsiveConfig.lg || allColumns.length;
			case "md":
				return (
					responsiveConfig.md ||
					responsiveConfig.sm ||
					Math.min(4, allColumns.length)
				);
			case "sm":
				return responsiveConfig.sm || Math.min(3, allColumns.length);
			default:
				return responsiveConfig.xs || Math.min(2, allColumns.length);
		}
	};

	const columnCount = getColumnCount();
	return allColumns.slice(0, columnCount);
}
