import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
	key: string;
	ctrlKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
	metaKey?: boolean;
	action: () => void;
	description?: string;
	preventDefault?: boolean;
	stopPropagation?: boolean;
	disabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
	shortcuts: KeyboardShortcut[];
	enabled?: boolean;
	target?: HTMLElement | Document;
}

/**
 * Hook for managing keyboard shortcuts
 * Supports common modifier keys and provides cleanup
 */
export function useKeyboardShortcuts({
	shortcuts,
	enabled = true,
	target,
}: UseKeyboardShortcutsOptions) {
	const shortcutsRef = useRef(shortcuts);
	shortcutsRef.current = shortcuts;

	const handleKeyDown = useCallback(
		(event: Event) => {
			const keyboardEvent = event as KeyboardEvent;
			if (!enabled) return;

			const activeShortcuts = shortcutsRef.current.filter(
				(shortcut) => !shortcut.disabled
			);

			for (const shortcut of activeShortcuts) {
				const keyMatches =
					keyboardEvent.key.toLowerCase() ===
					shortcut.key.toLowerCase();
				const ctrlMatches =
					!!shortcut.ctrlKey === keyboardEvent.ctrlKey;
				const altMatches = !!shortcut.altKey === keyboardEvent.altKey;
				const shiftMatches =
					!!shortcut.shiftKey === keyboardEvent.shiftKey;
				const metaMatches =
					!!shortcut.metaKey === keyboardEvent.metaKey;

				if (
					keyMatches &&
					ctrlMatches &&
					altMatches &&
					shiftMatches &&
					metaMatches
				) {
					if (shortcut.preventDefault !== false) {
						keyboardEvent.preventDefault();
					}
					if (shortcut.stopPropagation) {
						keyboardEvent.stopPropagation();
					}
					shortcut.action();
					break; // Only execute the first matching shortcut
				}
			}
		},
		[enabled]
	);

	useEffect(() => {
		const targetElement = target || document;

		if (enabled) {
			targetElement.addEventListener("keydown", handleKeyDown);
		}

		return () => {
			targetElement.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleKeyDown, enabled, target]);
}

/**
 * Common keyboard shortcuts for different contexts
 */
export const commonShortcuts = {
	// Navigation shortcuts
	navigation: {
		home: (action: () => void): KeyboardShortcut => ({
			key: "h",
			altKey: true,
			action,
			description: "Go to home",
		}),
		users: (action: () => void): KeyboardShortcut => ({
			key: "u",
			altKey: true,
			action,
			description: "Go to users",
		}),
		police: (action: () => void): KeyboardShortcut => ({
			key: "p",
			altKey: true,
			action,
			description: "Go to police",
		}),
		admin: (action: () => void): KeyboardShortcut => ({
			key: "a",
			altKey: true,
			action,
			description: "Go to admin",
		}),
	},

	// Table shortcuts
	table: {
		selectAll: (action: () => void): KeyboardShortcut => ({
			key: "a",
			ctrlKey: true,
			action,
			description: "Select all items",
		}),
		clearSelection: (action: () => void): KeyboardShortcut => ({
			key: "Escape",
			action,
			description: "Clear selection",
		}),
		refresh: (action: () => void): KeyboardShortcut => ({
			key: "r",
			ctrlKey: true,
			action,
			description: "Refresh data",
		}),
		search: (action: () => void): KeyboardShortcut => ({
			key: "f",
			ctrlKey: true,
			action,
			description: "Focus search",
		}),
		export: (action: () => void): KeyboardShortcut => ({
			key: "e",
			ctrlKey: true,
			action,
			description: "Export data",
		}),
	},

	// Form shortcuts
	form: {
		save: (action: () => void): KeyboardShortcut => ({
			key: "s",
			ctrlKey: true,
			action,
			description: "Save form",
		}),
		cancel: (action: () => void): KeyboardShortcut => ({
			key: "Escape",
			action,
			description: "Cancel form",
		}),
	},

	// Modal shortcuts
	modal: {
		close: (action: () => void): KeyboardShortcut => ({
			key: "Escape",
			action,
			description: "Close modal",
		}),
		confirm: (action: () => void): KeyboardShortcut => ({
			key: "Enter",
			ctrlKey: true,
			action,
			description: "Confirm action",
		}),
	},

	// General shortcuts
	general: {
		help: (action: () => void): KeyboardShortcut => ({
			key: "?",
			shiftKey: true,
			action,
			description: "Show help",
		}),
		toggleTheme: (action: () => void): KeyboardShortcut => ({
			key: "t",
			ctrlKey: true,
			shiftKey: true,
			action,
			description: "Toggle theme",
		}),
	},
};

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
	const parts: string[] = [];

	if (shortcut.ctrlKey) parts.push("Ctrl");
	if (shortcut.altKey) parts.push("Alt");
	if (shortcut.shiftKey) parts.push("Shift");
	if (shortcut.metaKey) parts.push("Cmd");

	// Format special keys
	let key = shortcut.key;
	switch (key.toLowerCase()) {
		case "escape":
			key = "Esc";
			break;
		case "enter":
			key = "Enter";
			break;
		case " ":
			key = "Space";
			break;
		case "arrowup":
			key = "↑";
			break;
		case "arrowdown":
			key = "↓";
			break;
		case "arrowleft":
			key = "←";
			break;
		case "arrowright":
			key = "→";
			break;
		default:
			key = key.toUpperCase();
	}

	parts.push(key);
	return parts.join(" + ");
}

/**
 * Hook for displaying keyboard shortcuts help
 */
export function useShortcutsHelp(shortcuts: KeyboardShortcut[]) {
	const shortcutsList = shortcuts
		.filter((s) => s.description)
		.map((s) => ({
			keys: formatShortcut(s),
			description: s.description!,
		}));

	return shortcutsList;
}
