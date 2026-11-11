import { describe, it, expect } from "vitest";
import { describeFieldError } from "./field-error.utils";

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
				"An officer named 'Alex Turner' already exists at Fremantle."
			)
		).toBe("An officer named 'Alex Turner' already exists at Fremantle.");
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
