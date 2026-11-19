import { describe, expect, it, vi } from "vitest";
import {
	applyServerFieldErrors,
	describeFieldError,
	serverFieldErrors,
} from "./field-error.utils";

describe("describeFieldError", () => {
	it("leaves a full sentence from the server as it is", () => {
		expect(
			describeFieldError(
				"invoice_raised_number",
				"This invoice-raised number is already used by another batch."
			)
		).toBe("This invoice-raised number is already used by another batch.");
		expect(
			describeFieldError(
				"last_name",
				"An officer named 'TURNER, Alex' already exists at Fremantle."
			)
		).toBe("An officer named 'TURNER, Alex' already exists at Fremantle.");
	});

	it.each([
		[
			"last_name",
			"This field is required.",
			"Last name: This field is required.",
		],
		[
			"case_number",
			"Ensure this field has no more than 50 characters.",
			"Case number: Ensure this field has no more than 50 characters.",
		],
		[
			"cost_per_bag",
			"Ensure this value is greater than or equal to 0.",
			"Cost per bag: Ensure this value is greater than or equal to 0.",
		],
	])(
		"names the field for a generic message (%s)",
		(field, message, expected) => {
			expect(describeFieldError(field, message)).toBe(expected);
		}
	);

	it("never shows non_field_errors as a field name", () => {
		expect(describeFieldError("non_field_errors", "This field is wrong.")).toBe(
			"This field is wrong."
		);
	});
});

describe("serverFieldErrors", () => {
	it("reads the API client's fieldErrors, first message per field", () => {
		expect(
			serverFieldErrors({
				message: "x",
				status: 400,
				fieldErrors: {
					badge_number: ["Badge number PD1 already belongs to TURNER, Alex."],
					last_name: ["First.", "Second."],
				},
			})
		).toEqual({
			badge_number: "Badge number PD1 already belongs to TURNER, Alex.",
			last_name: "First.",
		});
	});

	it("also reads a raw response body and ignores the debug block", () => {
		expect(
			serverFieldErrors({
				response: { data: { name: "Taken.", debug: { exception: "x" } } },
			})
		).toEqual({ name: "Taken." });
	});

	it("returns nothing for errors without field messages", () => {
		expect(serverFieldErrors(new Error("Network"))).toEqual({});
		expect(serverFieldErrors(null)).toEqual({});
		expect(serverFieldErrors("oops")).toEqual({});
	});
});

describe("applyServerFieldErrors", () => {
	it("sets each listed field the server rejected", () => {
		const setError = vi.fn();
		const shown = applyServerFieldErrors(
			{ fieldErrors: { badge_number: ["In use."], rank: ["Bad."] } },
			setError,
			["last_name", "badge_number"]
		);
		expect(shown).toBe(true);
		expect(setError).toHaveBeenCalledOnce();
		expect(setError).toHaveBeenCalledWith("badge_number", {
			type: "server",
			message: "In use.",
		});
	});

	it("reports false when no listed field was rejected", () => {
		const setError = vi.fn();
		expect(applyServerFieldErrors(new Error("x"), setError, ["name"])).toBe(
			false
		);
		expect(setError).not.toHaveBeenCalled();
	});
});
