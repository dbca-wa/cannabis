/**
 * UI hooks - User interface related hooks for responsive design, theming, navigation, and interactions
 */

// Responsive design utilities
export * from "./useResponsive";

// Theme management
export { useTheme } from "./useTheme";
export type { Theme, ResolvedTheme, UseThemeOptions, UseThemeReturn } from "./useTheme";

// Keyboard shortcuts
export { 
	useKeyboardShortcuts, 
	commonShortcuts, 
	formatShortcut, 
	useShortcutsHelp 
} from "./useKeyboardShortcuts";
export type { 
	KeyboardShortcut, 
	UseKeyboardShortcutsOptions 
} from "./useKeyboardShortcuts";

// Navigation utilities
export { useSidebarItem } from "./useSidebarItem";