// App version and environment helpers.
//
// The same built image is deployed to every environment, so the version is
// baked in at build time (VITE_VERSION) while the environment is derived from
// the host at runtime. This keeps a single artefact working across local,
// staging and production without rebuilding.

export type AppEnvironment = "LOCAL" | "TEST" | "PROD";

/**
 * The application version baked in at build time via the VITE_VERSION build
 * arg (set by CI to the git tag/describe value). Falls back to "Unset" for
 * local dev builds where no version is injected.
 */
export const getAppVersion = (): string =>
	import.meta.env.VITE_VERSION || "Unset";

/**
 * Determine the current environment from the host at runtime.
 * - localhost / 127.0.0.1 -> LOCAL
 * - hosts containing "test" or "uat" (e.g. cannabis-test.dbca.wa.gov.au) -> TEST
 * - anything else -> PROD
 */
export const getAppEnvironment = (): AppEnvironment => {
	if (typeof window === "undefined") return "LOCAL";
	const host = window.location.hostname;
	if (host.includes("localhost") || host.includes("127.0.0.1")) return "LOCAL";
	if (host.includes("test") || host.includes("uat")) return "TEST";
	return "PROD";
};

/**
 * Combined version + environment label, e.g. "1.0.7 (TEST)".
 */
export const getVersionLabel = (): string =>
	`${getAppVersion()} (${getAppEnvironment()})`;
