import { describe, it, expect } from "vitest";
import {
	getErrorMessage,
	getErrorCode,
	getAllErrorMessages,
	getFieldErrors,
	extractFieldErrors,
	normalizeError,
	isApiError,
	isError,
} from "./error.utils";

describe("error.utils", () => {
	describe("getErrorMessage", () => {
		it("returns the message from an ApiError", () => {
			expect(getErrorMessage({ message: "Bad request", status: 400 })).toBe(
				"Bad request"
			);
		});

		it("returns the message from a standard Error", () => {
			expect(getErrorMessage(new Error("boom"))).toBe("boom");
		});

		it("returns a plain string error unchanged", () => {
			expect(getErrorMessage("just a string")).toBe("just a string");
		});

		it("extracts a Django detail error from an axios response", () => {
			expect(
				getErrorMessage({ response: { data: { detail: "Not found" } } })
			).toBe("Not found");
		});

		it("extracts the first non-field error", () => {
			expect(
				getErrorMessage({
					response: { data: { non_field_errors: ["Invalid combo", "two"] } },
				})
			).toBe("Invalid combo");
		});

		it("formats Django field errors as 'Field: message'", () => {
			expect(
				getErrorMessage({
					response: { data: { case_number: ["This field is required."] } },
				})
			).toBe("Case Number: This field is required.");
		});

		it("falls back for unknown error shapes", () => {
			expect(getErrorMessage(null)).toBe("An unknown error occurred");
			expect(getErrorMessage(42)).toBe("An unknown error occurred");
		});
	});

	describe("extractFieldErrors", () => {
		it("title-cases snake_case field names and takes the first error", () => {
			expect(
				extractFieldErrors({
					security_movement_envelope: ["Required", "secondary"],
					email: "Bad email",
				})
			).toEqual(["Security Movement Envelope: Required", "Email: Bad email"]);
		});
	});

	describe("getFieldErrors", () => {
		it("returns a map of field -> messages from an axios field error", () => {
			expect(
				getFieldErrors({
					response: { data: { email: ["Bad email"], name: "Required" } },
				})
			).toEqual({ email: ["Bad email"], name: ["Required"] });
		});

		it("returns an empty map for non-field errors", () => {
			expect(getFieldErrors(new Error("x"))).toEqual({});
		});
	});

	describe("getAllErrorMessages", () => {
		it("collects every message from a Django field error response", () => {
			expect(
				getAllErrorMessages({
					response: { data: { a: ["one"], b: ["two"] } },
				})
			).toEqual(["A: one", "B: two"]);
		});
	});

	describe("getErrorCode", () => {
		it("derives an HTTP code from an axios error", () => {
			expect(getErrorCode({ response: { status: 404 } })).toBe("HTTP_404");
		});

		it("uses the Error name when present", () => {
			expect(getErrorCode(new TypeError("x"))).toBe("TypeError");
		});

		it("returns UNKNOWN_ERROR for unrecognised input", () => {
			expect(getErrorCode(undefined)).toBe("UNKNOWN_ERROR");
		});
	});

	describe("normalizeError", () => {
		it("produces a normalised shape with message and code", () => {
			const result = normalizeError({ message: "Nope", status: 403 });
			expect(result.message).toBe("Nope");
			expect(result.code).toBe("Nope");
			expect(result.originalError).toEqual({ message: "Nope", status: 403 });
		});
	});

	describe("type guards", () => {
		it("identifies ApiError and Error values", () => {
			expect(isApiError({ message: "m", status: 1 })).toBe(true);
			expect(isApiError(new Error("x"))).toBe(false);
			expect(isError(new Error("x"))).toBe(true);
			expect(isError("x")).toBe(false);
		});
	});
});
