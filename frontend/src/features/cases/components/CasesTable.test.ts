import { describe, it, expect } from "vitest";
import { getEligibleCertIds } from "./CasesTable";
import type { CaseTiny } from "@/shared/types/backend-api.types";
import type { Certificate } from "@/features/certificates/types/certificates.types";

/** Build a minimal CaseTiny for testing purposes. */
const buildCaseTiny = (forms: CaseTiny["forms"] = []): CaseTiny => ({
	id: 1,
	case_number: "TEST-001",
	derived_status: "assessment",
	derived_status_display: "Assessment",
	received: "2024-01-15",
	requesting_officer_name: null,
	requesting_officer_rank: null,
	requesting_officer_station: null,
	submitting_officer_name: null,
	submitting_officer_rank: null,
	submitting_officer_station: null,
	station_name: null,
	certificate_id: null,
	forms,
	forms_count: forms.length,
	bags_count: 0,
	certificates_count: 0,
	defendants_count: 0,
	defendant_names: [],
	cannabis_present: false,
	created_at: "2024-01-15T00:00:00Z",
});

/** Build a minimal Certificate for testing. */
const buildCertificate = (
	overrides: Partial<Certificate> = {}
): Certificate => ({
	id: 100,
	certificate_number: "CERT-100",
	form: 1,
	case_id: 1,
	case_number: "TEST-001",
	defendant_names: null,
	bag_ids: [],
	batch_id: null,
	batch_number: null,
	is_batch_eligible: false,
	certified_date: null,
	additional_notes: null,
	pdf_generating: false,
	pdf_file: null,
	pdf_url: null,
	pdf_size: 0,
	created_at: "2024-01-15T00:00:00Z",
	updated_at: "2024-01-15T00:00:00Z",
	...overrides,
});

describe("getEligibleCertIds", () => {
	it("returns IDs of batch-eligible certificates from forms", () => {
		const caseTiny = buildCaseTiny([
			{
				id: 1,
				case: 1,
				scanned_image_url: null,
				security_movement_envelope: "ENV-1",
				phase: "unsigned_generation",
				phase_display: "Unsigned Generation",
				bags_count: 2,
				certificate: buildCertificate({ id: 10, is_batch_eligible: true }),
				marked_ready: false,
				certificates_generated_at: "2024-01-15T10:00:00Z",
				completed_at: null,
			},
			{
				id: 2,
				case: 1,
				scanned_image_url: null,
				security_movement_envelope: "ENV-2",
				phase: "unsigned_generation",
				phase_display: "Unsigned Generation",
				bags_count: 3,
				certificate: buildCertificate({ id: 20, is_batch_eligible: true }),
				marked_ready: false,
				certificates_generated_at: "2024-01-15T11:00:00Z",
				completed_at: null,
			},
		]);

		const result = getEligibleCertIds(caseTiny);

		expect(result).toEqual([10, 20]);
	});

	it("excludes certificates that are not batch-eligible", () => {
		const caseTiny = buildCaseTiny([
			{
				id: 1,
				case: 1,
				scanned_image_url: null,
				security_movement_envelope: "ENV-1",
				phase: "unsigned_generation",
				phase_display: "Unsigned Generation",
				bags_count: 1,
				certificate: buildCertificate({ id: 10, is_batch_eligible: true }),
				marked_ready: false,
				certificates_generated_at: "2024-01-15T10:00:00Z",
				completed_at: null,
			},
			{
				id: 2,
				case: 1,
				scanned_image_url: null,
				security_movement_envelope: "ENV-2",
				phase: "assessment",
				phase_display: "Assessment",
				bags_count: 2,
				certificate: buildCertificate({ id: 30, is_batch_eligible: false }),
				marked_ready: false,
				certificates_generated_at: null,
				completed_at: null,
			},
		]);

		const result = getEligibleCertIds(caseTiny);

		expect(result).toEqual([10]);
	});

	it("returns empty array when forms have null certificates", () => {
		const caseTiny = buildCaseTiny([
			{
				id: 1,
				case: 1,
				scanned_image_url: null,
				security_movement_envelope: "ENV-1",
				phase: "assessment",
				phase_display: "Assessment",
				bags_count: 0,
				certificate: null,
				marked_ready: false,
				certificates_generated_at: null,
				completed_at: null,
			},
			{
				id: 2,
				case: 1,
				scanned_image_url: null,
				security_movement_envelope: "ENV-2",
				phase: "assessment",
				phase_display: "Assessment",
				bags_count: 0,
				certificate: null,
				marked_ready: false,
				certificates_generated_at: null,
				completed_at: null,
			},
		]);

		const result = getEligibleCertIds(caseTiny);

		expect(result).toEqual([]);
	});

	it("returns empty array when there are no forms", () => {
		const caseTiny = buildCaseTiny([]);

		const result = getEligibleCertIds(caseTiny);

		expect(result).toEqual([]);
	});
});
