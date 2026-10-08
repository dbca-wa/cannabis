/**
 * Page-view audit beacon.
 *
 * The backend audit log records what a user is doing by page, not by API call —
 * a single clean line per navigation, independent of the many data fetches a
 * page triggers. This maps the current route to a stable page key (and object
 * id for record pages) the backend allow-lists, and posts it best-effort.
 */
import { apiClient, ENDPOINTS } from "@/shared/services/api";

export interface PageViewPayload {
	page: string;
	object_id?: string;
}

/** Map a pathname to the page key + optional object id the backend expects. */
export const resolvePageView = (pathname: string): PageViewPayload | null => {
	// Normalise: strip trailing slash (except root), ignore query/hash.
	const path = pathname.replace(/\/+$/, "") || "/";
	const seg = path.split("/").filter(Boolean); // e.g. ["cases", "123"]

	if (path === "/") return { page: "dashboard" };

	const [root, second] = seg;

	switch (root) {
		case "cases":
			if (second === "add") return { page: "case-create" };
			// /cases/:id and /cases/:id/forms/:formId are the same case page.
			if (second && /^\d+$/.test(second))
				return { page: "case", object_id: second };
			return { page: "cases" };

		case "batches":
			if (second && /^\d+$/.test(second))
				return { page: "batch", object_id: second };
			return { page: "batches" };

		case "officers":
			if (second && /^\d+$/.test(second))
				return { page: "officer", object_id: second };
			return { page: "officers" };

		case "stations":
			if (second && /^\d+$/.test(second))
				return { page: "station", object_id: second };
			return { page: "stations" };

		case "defendants":
			if (second && /^\d+$/.test(second))
				return { page: "defendant", object_id: second };
			return { page: "defendants" };

		case "staff":
			return { page: "staff" };
		case "invites":
			return { page: "invitations" };
		case "settings":
			return { page: "settings" };
		case "testing":
			return { page: "testing" };
		case "guide":
			return { page: "guide" };
		case "change-password":
			return { page: "change-password" };

		default:
			return null; // Unmapped route — no beacon.
	}
};

/** Fire the beacon. Best-effort: audit must never disrupt the user. */
export const sendPageView = async (payload: PageViewPayload): Promise<void> => {
	try {
		await apiClient.post(ENDPOINTS.SYSTEM.PAGE_VIEW, payload);
	} catch {
		// Swallow — a missed audit line must not surface to the user.
	}
};
