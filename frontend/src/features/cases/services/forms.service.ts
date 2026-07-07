import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import type {
	Certificate,
	DrugBag,
	FormCertificateGenerateRequest,
	FormWorkflowResponse,
	Priority3Form,
	Priority3FormCreateRequest,
	Priority3FormUpdateRequest,
} from "@/shared/types/backend-api.types";
import type { DrugBagBatchCreateRequest } from "../types/drugBags.types";

/**
 * Priority 3 form service — a case contains one or more forms, and each form
 * owns its scanned image, its drug bags (at most five), and its single
 * certificate. Endpoints are relative to the API base URL (no /api/v1 prefix).
 */

/** List the Priority 3 forms belonging to a case. */
export const getCaseForms = async (
	caseId: number
): Promise<Priority3Form[]> => {
	return apiClient.get<Priority3Form[]>(ENDPOINTS.CASES.FORMS.LIST(caseId));
};

/** Add a new Priority 3 form to a case. */
export const createCaseForm = async (
	caseId: number,
	data: Priority3FormCreateRequest = {}
): Promise<Priority3Form> => {
	return apiClient.post<Priority3Form>(
		ENDPOINTS.CASES.FORMS.CREATE(caseId),
		data
	);
};

/** Retrieve a single Priority 3 form with its bags and certificate. */
export const getFormById = async (formId: number): Promise<Priority3Form> => {
	return apiClient.get<Priority3Form>(ENDPOINTS.CASES.FORMS.DETAIL(formId));
};

/** Update a Priority 3 form's editable fields. */
export const updateForm = async (
	formId: number,
	data: Priority3FormUpdateRequest
): Promise<Priority3Form> => {
	return apiClient.patch<Priority3Form>(
		ENDPOINTS.CASES.FORMS.UPDATE(formId),
		data
	);
};

/** Delete a Priority 3 form (blocked once its certificate is batched). */
export const deleteForm = async (formId: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.CASES.FORMS.DELETE(formId));
};

/** Add drug bags (with optional assessments) to a form, capped at five. */
export const addBagsToForm = async (
	formId: number,
	data: DrugBagBatchCreateRequest
): Promise<DrugBag[]> => {
	return apiClient.post<DrugBag[]>(
		ENDPOINTS.CASES.FORMS.BAGS_BATCH(formId),
		data
	);
};

/** Generate (or re-render) the form's single certificate. */
export const generateFormCertificate = async (
	formId: number,
	data: FormCertificateGenerateRequest = {}
): Promise<Certificate> => {
	return apiClient.post<Certificate>(
		ENDPOINTS.CASES.FORMS.CERTIFICATE_GENERATE(formId),
		data
	);
};

/** Attach or replace the form's scanned Priority 3 image. */
export const uploadFormScannedImage = async (
	formId: number,
	file: File
): Promise<Priority3Form> => {
	const formData = new FormData();
	formData.append("file", file);

	return apiClient.post<Priority3Form>(
		ENDPOINTS.CASES.FORMS.SCANNED_IMAGE(formId),
		formData,
		{ headers: { "Content-Type": "multipart/form-data" } }
	);
};

/** Advance the form to its next workflow phase. */
export const advanceFormPhase = async (
	formId: number
): Promise<FormWorkflowResponse> => {
	return apiClient.post<FormWorkflowResponse>(
		ENDPOINTS.CASES.FORMS.WORKFLOW(formId),
		{ action: "advance_phase" }
	);
};
