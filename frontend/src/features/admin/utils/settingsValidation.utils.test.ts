import { describe, it, expect } from "vitest";
import {
	validatePricingField,
	validateEmail,
	validateBoolean,
	validateCompleteSettings,
	formatPercentage,
	parseCurrencyInput,
	parsePercentageInput,
	isPricingField,
	isPercentageField,
	isEmailField,
	isBooleanField,
	getFieldDisplayName,
} from "./settingsValidation.utils";

describe("settingsValidation.utils", () => {
	describe("validatePricingField", () => {
		it("accepts a well-formed currency value", () => {
			expect(validatePricingField("cost_per_certificate", "110.00")).toEqual({
				isValid: true,
				error: "",
			});
		});

		it("rejects an empty required field", () => {
			const result = validatePricingField("cost_per_bag", "");
			expect(result.isValid).toBe(false);
			expect(result.error).toMatch(/required/i);
		});

		it("rejects a non-numeric value", () => {
			expect(validatePricingField("call_out_fee", "abc").isValid).toBe(false);
		});

		it("enforces the minimum value", () => {
			const result = validatePricingField("cost_per_certificate", "0");
			expect(result.isValid).toBe(false);
			expect(result.error).toMatch(/at least/i);
		});

		it("enforces the decimal-place limit", () => {
			const result = validatePricingField("cost_per_certificate", "1.234");
			expect(result.isValid).toBe(false);
			expect(result.error).toMatch(/decimal/i);
		});

		it("rejects an unknown field", () => {
			expect(validatePricingField("nope", "1").isValid).toBe(false);
		});
	});

	describe("validateEmail", () => {
		it("accepts a valid address", () => {
			expect(validateEmail("admin@dbca.wa.gov.au").isValid).toBe(true);
		});

		it("rejects empty, malformed, and consecutive-dot addresses", () => {
			expect(validateEmail("").isValid).toBe(false);
			expect(validateEmail("not-an-email").isValid).toBe(false);
			expect(validateEmail("a..b@example.com").isValid).toBe(false);
		});
	});

	describe("validateBoolean", () => {
		it("accepts boolean-like values", () => {
			expect(validateBoolean("send_emails_to_self", true).isValid).toBe(true);
			expect(validateBoolean("send_emails_to_self", "yes").isValid).toBe(true);
			expect(validateBoolean("send_emails_to_self", 1).isValid).toBe(true);
		});

		it("rejects null and nonsense values", () => {
			expect(validateBoolean("send_emails_to_self", null).isValid).toBe(false);
			expect(validateBoolean("send_emails_to_self", "maybe").isValid).toBe(
				false
			);
		});
	});

	describe("validateCompleteSettings", () => {
		it("passes when every supplied field is valid", () => {
			const result = validateCompleteSettings({
				cost_per_certificate: "110.00",
				cost_per_bag: "11.00",
				tax_percentage: "10.00",
			});
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("collects errors for invalid fields", () => {
			const result = validateCompleteSettings({
				cost_per_certificate: "-1",
				tax_percentage: "200",
			});
			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe("formatting + parsing helpers", () => {
		it("formats a percentage", () => {
			expect(formatPercentage(11)).toBe("11.00%");
			expect(formatPercentage("not a number")).toBe("0.00%");
		});

		it("parses currency input, stripping symbols", () => {
			expect(parseCurrencyInput("$1,234.50")).toEqual({
				value: "1234.50",
				isValid: true,
			});
			expect(parseCurrencyInput("").isValid).toBe(false);
		});

		it("parses percentage input within 0-100", () => {
			expect(parsePercentageInput("11").isValid).toBe(true);
			expect(parsePercentageInput("150").isValid).toBe(false);
		});
	});

	describe("field classifiers", () => {
		it("classifies fields by type", () => {
			expect(isPricingField("cost_per_bag")).toBe(true);
			expect(isPercentageField("tax_percentage")).toBe(true);
			expect(isEmailField("forward_certificate_emails_to")).toBe(true);
			expect(isBooleanField("send_emails_to_self")).toBe(true);
			expect(isPricingField("tax_percentage")).toBe(false);
		});

		it("returns friendly display names", () => {
			expect(getFieldDisplayName("cost_per_bag")).toBe(
				"Bag identification cost"
			);
			expect(getFieldDisplayName("some_other_field")).toBe("Some Other Field");
		});
	});
});
