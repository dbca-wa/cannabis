/**
 * Fires one page-view audit beacon per navigation.
 *
 * Mounted once inside the authenticated layout. Watches the route and posts a
 * single beacon when the resolved page (key + object id) changes, so a page's
 * own re-renders never re-log, while genuinely navigating to a new page — or to
 * a different record of the same type — logs once each.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { resolvePageView, sendPageView } from "@/shared/services/pageViewAudit";

export const usePageViewAudit = (): void => {
	const { pathname } = useLocation();
	const lastKey = useRef<string | null>(null);

	useEffect(() => {
		const payload = resolvePageView(pathname);
		if (!payload) return;

		// Dedupe consecutive identical views (re-renders, query/hash changes).
		const key = `${payload.page}:${payload.object_id ?? ""}`;
		if (key === lastKey.current) return;
		lastKey.current = key;

		void sendPageView(payload);
	}, [pathname]);
};
