import { useCallback, useEffect, useState } from "react";
import { logger } from "@/shared/services/logger.service";

/** Build identifier compiled into this bundle. */
declare const __BUILD_ID__: string;

const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface VersionPayload {
	buildId?: unknown;
}

const isVersionPayload = (value: unknown): value is VersionPayload =>
	typeof value === "object" && value !== null;

/**
 * Detect when the deployed build no longer matches the one running in this tab.
 *
 * A tab left open across a deployment keeps executing its original bundle. If
 * that bundle is also held in the browser or an intermediary cache, a reload can
 * return the same stale code, which presents as data that will not appear no
 * matter how often the user refreshes. Comparing against the deployed identifier
 * lets the app say so plainly and offer a hard reload.
 *
 * Checks on an interval and whenever the tab regains focus.
 */
export const useDeployedVersion = () => {
	const [isOutdated, setIsOutdated] = useState(false);

	const check = useCallback(async () => {
		try {
			// Bypass any cache: a stale version.json would defeat the whole check.
			const response = await fetch(`${VERSION_URL}?_=${Date.now()}`, {
				cache: "no-store",
				headers: { "Cache-Control": "no-cache" },
			});
			if (!response.ok) return;

			const payload: unknown = await response.json();
			if (!isVersionPayload(payload)) return;
			if (typeof payload.buildId !== "string") return;

			if (payload.buildId !== __BUILD_ID__) {
				logger.warn("Running an outdated build", {
					running: __BUILD_ID__,
					deployed: payload.buildId,
				});
				setIsOutdated(true);
			}
		} catch {
			// Offline or the endpoint is unavailable — nothing to report.
		}
	}, []);

	// Only subscriptions here — no check runs synchronously on mount. A tab that
	// has just loaded is by definition running the build it fetched, so the first
	// meaningful comparison is the one after it has been open a while, or when it
	// regains focus having sat in the background across a deployment.
	useEffect(() => {
		const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);
		const onFocus = () => void check();
		window.addEventListener("focus", onFocus);

		return () => {
			window.clearInterval(interval);
			window.removeEventListener("focus", onFocus);
		};
	}, [check]);

	/** Reload from the network rather than from cache. */
	const reload = useCallback(() => {
		// Adding a parameter defeats a cache that would otherwise return the same
		// document, which a plain reload cannot guarantee.
		const url = new URL(window.location.href);
		url.searchParams.set("_r", Date.now().toString(36));
		window.location.replace(url.toString());
	}, []);

	return { isOutdated, reload };
};
