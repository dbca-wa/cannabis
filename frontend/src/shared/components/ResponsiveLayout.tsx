import type { ReactNode } from "react";

interface ResponsiveLayoutProps {
	/**
	 * Content to render on mobile viewports.
	 * DOM order should match mobile visual order (top to bottom).
	 */
	mobileContent: ReactNode;

	/**
	 * Content to render on desktop viewports.
	 * DOM order should match desktop visual order (left to right, then down).
	 */
	desktopContent: ReactNode;

	/** Optional className applied to both layout containers. */
	className?: string;

	/**
	 * Tailwind breakpoint at which to switch from mobile to desktop layout.
	 * @default "md" (768px)
	 */
	breakpoint?: "sm" | "md" | "lg" | "xl";
}

/**
 * Renders separate mobile and desktop layouts using a show/hide pattern,
 * ensuring DOM order matches visual order at each breakpoint.
 *
 * This avoids using CSS `order` which breaks keyboard tab navigation
 * for interactive elements (WCAG 2.4.3 Focus Order).
 */
export const ResponsiveLayout = ({
	mobileContent,
	desktopContent,
	className = "",
	breakpoint = "md",
}: ResponsiveLayoutProps) => {
	const breakpointClasses = {
		sm: { mobile: "sm:hidden", desktop: "hidden sm:block" },
		md: { mobile: "md:hidden", desktop: "hidden md:block" },
		lg: { mobile: "lg:hidden", desktop: "hidden lg:block" },
		xl: { mobile: "xl:hidden", desktop: "hidden xl:block" },
	};

	const classes = breakpointClasses[breakpoint];

	return (
		<>
			{/* Mobile layout — DOM order matches mobile visual order */}
			<div className={`${classes.mobile} ${className}`}>{mobileContent}</div>

			{/* Desktop layout — DOM order matches desktop visual order */}
			<div className={`${classes.desktop} ${className}`}>{desktopContent}</div>
		</>
	);
};
