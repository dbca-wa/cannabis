import { useEffect } from "react";

/**
 * Sets the browser tab title and restores the previous title on unmount.
 *
 * @param title - Page-specific title. Non-empty values produce "{title} | Cannabis",
 *                empty string produces "Cannabis".
 */
export function useDocumentTitle(title: string): void {
	useEffect(() => {
		const previousTitle = document.title;
		document.title = title ? `${title} | Cannabis` : "Cannabis";
		return () => {
			document.title = previousTitle;
		};
	}, [title]);
}
