import { describe, it, expect } from "vitest";
import { isFormStale } from "./certificateStaleness";
import type { Priority3Form } from "@/shared/types/backend-api.types";

const T0 = "2026-03-20T10:00:00Z"; // earlier
const T1 = "2026-03-20T11:00:00Z"; // later

const form = (overrides: {
	cert?: {
		updated_at?: string;
		batch_id?: number | null;
		pdf_url?: string | null;
		pdf_file?: string | null;
	} | null;
	bags?: Array<{ updated_at: string; assessmentUpdatedAt?: string }>;
	/** When the form itself (SME, Section C notes) last changed. */
	formUpdatedAt?: string;
}): Priority3Form => {
	const cert =
		overrides.cert === undefined
			? {
					updated_at: T0,
					batch_id: null,
					pdf_url: "cert.pdf",
					pdf_file: null,
				}
			: overrides.cert;
	return {
		id: 1,
		updated_at: overrides.formUpdatedAt,
		bags: (overrides.bags ?? []).map((b, i) => ({
			id: i + 1,
			updated_at: b.updated_at,
			assessment: b.assessmentUpdatedAt
				? { updated_at: b.assessmentUpdatedAt }
				: null,
		})),
		certificate: cert,
	} as unknown as Priority3Form;
};

describe("isFormStale", () => {
	it("is false when there is no certificate", () => {
		expect(isFormStale(form({ cert: null, bags: [{ updated_at: T1 }] }))).toBe(
			false
		);
	});

	it("is false when the certificate has no generated PDF", () => {
		expect(
			isFormStale(
				form({
					cert: {
						updated_at: T0,
						batch_id: null,
						pdf_url: null,
						pdf_file: null,
					},
					bags: [{ updated_at: T1 }],
				})
			)
		).toBe(false);
	});

	it("is false when the certificate is batched (frozen)", () => {
		expect(
			isFormStale(
				form({
					cert: { updated_at: T0, batch_id: 5, pdf_url: "c.pdf" },
					bags: [{ updated_at: T1 }],
				})
			)
		).toBe(false);
	});

	it("is false when every bag predates the certificate", () => {
		expect(
			isFormStale(
				form({
					cert: { updated_at: T1, pdf_url: "c.pdf" },
					bags: [{ updated_at: T0 }],
				})
			)
		).toBe(false);
	});

	it("is true when a bag was updated after the certificate", () => {
		expect(
			isFormStale(
				form({
					cert: { updated_at: T0, pdf_url: "c.pdf" },
					bags: [{ updated_at: T1 }],
				})
			)
		).toBe(true);
	});

	it("is true when a bag's assessment was updated after the certificate", () => {
		expect(
			isFormStale(
				form({
					cert: { updated_at: T0, pdf_url: "c.pdf" },
					bags: [{ updated_at: T0, assessmentUpdatedAt: T1 }],
				})
			)
		).toBe(true);
	});

	// The form's own fields (SME, Section C notes) are on the certificate too.
	it("is true when the form itself changed after the certificate", () => {
		expect(
			isFormStale(
				form({
					cert: { updated_at: T0, pdf_url: "c.pdf" },
					bags: [{ updated_at: T0 }],
					formUpdatedAt: T1,
				})
			)
		).toBe(true);
	});

	it("is false when the form last changed before the certificate", () => {
		expect(
			isFormStale(
				form({
					cert: { updated_at: T1, pdf_url: "c.pdf" },
					bags: [{ updated_at: T0 }],
					formUpdatedAt: T0,
				})
			)
		).toBe(false);
	});
});
