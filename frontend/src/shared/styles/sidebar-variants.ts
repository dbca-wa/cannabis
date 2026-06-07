/** Sidebar background colour variants for experimentation. */
export const SIDEBAR_BG_VARIANTS = {
	/** Default: clean white/dark background matching the theme */
	default: "bg-sidebar",
	/**
	 * Cannabis: subtle emerald-to-teal tinted gradient that complements the app's
	 * colour scheme. Light mode uses very faint green/teal tints on white.
	 * Dark mode uses muted emerald/teal tones close to the main background
	 * so the sidebar doesn't feel disconnected from the content area.
	 */
	cannabis:
		"bg-white bg-gradient-to-b from-emerald-50/60 via-white to-teal-50/40 dark:bg-[#161b1e] dark:from-emerald-950/20 dark:via-[#161b1e] dark:to-teal-950/15",
} as const;

export type SidebarBgVariant = keyof typeof SIDEBAR_BG_VARIANTS;
