/**
 * Navigation utilities for handling Ctrl+Click / Cmd+Click to open in new tab
 */

/**
 * Platform detection utility.
 * Returns the appropriate modifier key for the current platform.
 */
export const getPlatformModifierKey = (): "ctrlKey" | "metaKey" => {
	try {
		const platform = navigator.platform?.toLowerCase() || "";
		return platform.includes("mac") ? "metaKey" : "ctrlKey";
	} catch {
		return "ctrlKey";
	}
};

/**
 * Checks if the appropriate modifier key is pressed for the current platform.
 * Mac: Cmd key, Windows/Linux: Ctrl key.
 */
export const hasModifierKey = (event: MouseEvent | KeyboardEvent): boolean => {
	const modifierKey = getPlatformModifierKey();
	return event[modifierKey] === true;
};

/**
 * Handles a navigable click event:
 * - Ctrl/Cmd+Click: opens the URL in a new tab
 * - Normal click: uses the provided navigate callback
 */
export const handleNavigableClick = (
	event: React.MouseEvent,
	url: string,
	navigate: (path: string) => void
) => {
	if (event.ctrlKey || event.metaKey) {
		window.open(url, "_blank");
	} else {
		navigate(url);
	}
};
