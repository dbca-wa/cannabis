import { isApiError } from "@/shared/utils/error.utils";

/** The HTTP status carried by a failed request, or null when there is none. */
export const getErrorStatus = (error: unknown): number | null => {
	if (isApiError(error)) return error.status;
	if (error && typeof error === "object") {
		if ("status" in error) {
			const status = (error as { status: unknown }).status;
			if (typeof status === "number") return status;
		}
		const response = (error as { response?: { status?: unknown } }).response;
		if (response && typeof response.status === "number") return response.status;
	}
	return null;
};

/**
 * A query retry rule that tries again up to `maxRetries` times for server
 * and network errors, but never for 4xx responses. A record that is missing
 * or not visible (404) or refused (403) will not appear by retrying, so the
 * page shows its "not found" message straight away instead of loading for
 * several seconds.
 */
export const retryUnlessClientError =
	(maxRetries: number) =>
	(failureCount: number, error: Error): boolean => {
		const status = getErrorStatus(error);
		if (status !== null && status >= 400 && status < 500) return false;
		return failureCount < maxRetries;
	};
