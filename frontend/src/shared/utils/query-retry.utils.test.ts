import { describe, expect, it } from "vitest";
import { getErrorStatus, retryUnlessClientError } from "./query-retry.utils";

describe("getErrorStatus", () => {
	it("reads the status from API, plain and axios-style errors", () => {
		expect(getErrorStatus({ message: "x", status: 404 })).toBe(404);
		expect(getErrorStatus({ response: { status: 500 } })).toBe(500);
		expect(getErrorStatus(new Error("Network"))).toBeNull();
		expect(getErrorStatus(null)).toBeNull();
	});
});

describe("retryUnlessClientError", () => {
	const retry = retryUnlessClientError(3);

	it("never retries a 4xx response", () => {
		expect(
			retry(0, { message: "Not found", status: 404 } as unknown as Error)
		).toBe(false);
		expect(
			retry(0, { message: "Forbidden", status: 403 } as unknown as Error)
		).toBe(false);
		expect(retry(0, { message: "Bad", status: 400 } as unknown as Error)).toBe(
			false
		);
	});

	it("retries server and network errors up to the limit", () => {
		expect(retry(0, { message: "x", status: 500 } as unknown as Error)).toBe(
			true
		);
		expect(retry(2, new Error("Network"))).toBe(true);
		expect(retry(3, new Error("Network"))).toBe(false);
	});
});
