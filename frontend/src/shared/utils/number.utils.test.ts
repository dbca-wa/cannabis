import { describe, it, expect } from "vitest";
import { formatCurrency, formatFileSize } from "./number.utils";

describe("number.utils", () => {
	describe("formatCurrency", () => {
		it("formats numbers as AUD currency", () => {
			// Non-breaking space may separate symbol and digits depending on ICU.
			expect(formatCurrency(1234.5).replace(/\u00a0/g, " ")).toBe("$1,234.50");
			expect(formatCurrency(0).replace(/\u00a0/g, " ")).toBe("$0.00");
		});

		it("parses numeric strings", () => {
			expect(formatCurrency("99.9").replace(/\u00a0/g, " ")).toBe("$99.90");
		});

		it("returns $0.00 for non-numeric input", () => {
			expect(formatCurrency("not a number")).toBe("$0.00");
		});
	});

	describe("formatFileSize", () => {
		it("formats bytes", () => {
			expect(formatFileSize(512)).toBe("512 B");
		});

		it("formats kilobytes", () => {
			expect(formatFileSize(2048)).toBe("2.0 KB");
		});

		it("formats megabytes", () => {
			expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
		});
	});
});
