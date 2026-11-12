import { describe, expect, it } from "vitest";
import type { Priority3Form } from "@/shared/types/backend-api.types";
import { nextCertificateAction } from "./useCaseCertificates";

const certificate = (overrides: Record<string, unknown> = {}) => ({
	id: 1,
	pdf_url: "/media/c.pdf",
	pdf_file: "c.pdf",
	additional_notes: null,
	batch_id: null,
	updated_at: "2026-11-01T00:00:00Z",
	...overrides,
});

const form = (
	certificateValue: unknown,
	markedReady = false,
	bags: unknown[] = [{ id: 1, updated_at: "2026-10-01T00:00:00Z" }]
) =>
	({
		id: 1,
		bags,
		certificate: certificateValue,
		marked_ready: markedReady,
		additional_notes: null,
	}) as unknown as Priority3Form;

describe("nextCertificateAction", () => {
	it("generates while any certificate is missing", () => {
		expect(nextCertificateAction([form(certificate(), true), form(null)])).toBe(
			"generate"
		);
	});

	it("regenerates while any certificate is out of date", () => {
		expect(
			nextCertificateAction([
				form(certificate({ needs_regeneration: true })),
				form(certificate(), true),
			])
		).toBe("regenerate");
	});

	it("marks ready once every certificate is current", () => {
		expect(
			nextCertificateAction([form(certificate(), true), form(certificate())])
		).toBe("markReady");
	});

	it("has nothing left once every form is marked ready", () => {
		expect(nextCertificateAction([form(certificate(), true)])).toBeNull();
	});

	it("ignores forms without bags", () => {
		expect(nextCertificateAction([form(null, false, [])])).toBeNull();
		expect(
			nextCertificateAction([form(null, false, []), form(certificate(), true)])
		).toBeNull();
	});
});
