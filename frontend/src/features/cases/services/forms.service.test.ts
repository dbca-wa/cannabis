import { describe, it, expect, vi, beforeEach } from "vitest";
import { ENDPOINTS } from "@/shared/services/api/endpoints";

// Mock the apiClient before importing the service
vi.mock("@/shared/services/api", () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	},
}));

import { apiClient } from "@/shared/services/api";
import {
	generateFormCertificate,
	addBagsToForm,
	createCaseForm,
} from "./forms.service";

describe("forms.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("generateFormCertificate", () => {
		it("calls the correct endpoint with the section_c_note payload", async () => {
			const formId = 42;
			const payload = { section_c_note: "Sample note for Section C" };
			const mockCertificate = { id: 1, certificate_number: "CERT-001" };

			vi.mocked(apiClient.post).mockResolvedValue(mockCertificate);

			const result = await generateFormCertificate(formId, payload);

			expect(apiClient.post).toHaveBeenCalledWith(
				ENDPOINTS.CASES.FORMS.CERTIFICATE_GENERATE(formId),
				payload
			);
			expect(apiClient.post).toHaveBeenCalledWith(
				`/cases/forms/${formId}/certificate/generate`,
				payload
			);
			expect(result).toEqual(mockCertificate);
		});

		it("calls with empty payload when no options provided", async () => {
			const formId = 7;
			vi.mocked(apiClient.post).mockResolvedValue({ id: 2 });

			await generateFormCertificate(formId);

			expect(apiClient.post).toHaveBeenCalledWith(
				`/cases/forms/${formId}/certificate/generate`,
				{}
			);
		});
	});

	describe("addBagsToForm", () => {
		it("posts to the bags/batch endpoint with the bag data", async () => {
			const formId = 10;
			const data = {
				bags: [
					{
						seal_tag_numbers: "TAG-001",
						content_type: "plant" as const,
					},
				],
			};
			const mockBags = [{ id: 1, seal_tag_numbers: "TAG-001" }];

			vi.mocked(apiClient.post).mockResolvedValue(mockBags);

			const result = await addBagsToForm(formId, data);

			expect(apiClient.post).toHaveBeenCalledWith(
				ENDPOINTS.CASES.FORMS.BAGS_BATCH(formId),
				data
			);
			expect(apiClient.post).toHaveBeenCalledWith(
				`/cases/forms/${formId}/bags/batch`,
				data
			);
			expect(result).toEqual(mockBags);
		});
	});

	describe("createCaseForm", () => {
		it("posts to the case forms endpoint", async () => {
			const caseId = 5;
			const mockForm = { id: 1, case: caseId, phase: "case_creation" };

			vi.mocked(apiClient.post).mockResolvedValue(mockForm);

			const result = await createCaseForm(caseId);

			expect(apiClient.post).toHaveBeenCalledWith(
				ENDPOINTS.CASES.FORMS.CREATE(caseId),
				{}
			);
			expect(apiClient.post).toHaveBeenCalledWith(`/cases/${caseId}/forms`, {});
			expect(result).toEqual(mockForm);
		});
	});
});
