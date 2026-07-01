import { apiClient } from "@/shared/services/api";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import {
	type Case,
	type PaginatedCasesResponse,
	type CasesSearchParams,
	type CaseCreateRequest,
	type CaseUpdateRequest,
	type WorkflowActionRequest,
	type WorkflowActionResponse,
	type PhaseHistoryEntry,
} from "@/shared/types/backend-api.types";

/**
 * Get paginated list of cases with search and filtering
 */
export const getCases = async (
	params: CasesSearchParams = {}
): Promise<PaginatedCasesResponse> => {
	const cleanParams = buildQueryParams({
		search: params.search,
		phase: params.phase,
		botanist: params.botanist,
		officer: params.officer,
		station: params.station,
		finance: params.finance,
		cannabis_only: params.cannabis_only,
		date_from: params.date_from,
		date_to: params.date_to,
		tag_search: params.tag_search,
		full: params.full,
		page: params.page,
		limit: params.limit,
		offset: params.offset,
		ordering: params.ordering,
	});

	const searchParams = new URLSearchParams();
	Object.entries(cleanParams).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((v) => searchParams.append(key, String(v)));
		} else {
			searchParams.append(key, String(value));
		}
	});

	const queryString = searchParams.toString();
	const endpoint = queryString
		? `${ENDPOINTS.CASES.LIST}?${queryString}`
		: ENDPOINTS.CASES.LIST;

	return apiClient.get<PaginatedCasesResponse>(endpoint);
};

/**
 * Get case by ID with full details
 */
export const getCaseById = async (id: number): Promise<Case> => {
	return apiClient.get<Case>(ENDPOINTS.CASES.DETAIL(id));
};

/**
 * Create new case
 */
export const createCase = async (data: CaseCreateRequest): Promise<Case> => {
	return apiClient.post<Case>(ENDPOINTS.CASES.CREATE, data);
};

/**
 * Update existing case
 */
export const updateCase = async (
	id: number,
	data: CaseUpdateRequest
): Promise<Case> => {
	return apiClient.patch<Case>(ENDPOINTS.CASES.UPDATE(id), data);
};

/**
 * Delete case
 */
export const deleteCase = async (id: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.CASES.DELETE(id));
};

/**
 * Check whether a police reference (case number) already exists on another case.
 * Pass excludeId when editing an existing case so it doesn't match itself.
 */
export const checkCaseNumberExists = async (
	caseNumber: string,
	excludeId?: number | null
): Promise<boolean> => {
	const params = new URLSearchParams({ case_number: caseNumber });
	if (excludeId != null) {
		params.append("exclude_id", String(excludeId));
	}
	const response = await apiClient.get<{ exists: boolean }>(
		`${ENDPOINTS.CASES.CHECK_NUMBER}?${params.toString()}`
	);
	return response.exists;
};

/**
 * Execute workflow action on case
 */
export const executeWorkflowAction = async (
	id: number,
	action: WorkflowActionRequest
): Promise<WorkflowActionResponse> => {
	return apiClient.post<WorkflowActionResponse>(
		ENDPOINTS.CASES.WORKFLOW(id),
		action
	);
};

/**
 * Get phase history for a case
 */
export const getPhaseHistory = async (
	id: number,
	params: { action?: string; user?: number; ordering?: string } = {}
): Promise<PhaseHistoryEntry[]> => {
	const cleanParams = buildQueryParams({
		action: params.action,
		user: params.user,
		ordering: params.ordering,
	});

	const searchParams = new URLSearchParams();
	Object.entries(cleanParams).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((v) => searchParams.append(key, String(v)));
		} else {
			searchParams.append(key, String(value));
		}
	});

	const queryString = searchParams.toString();
	const endpoint = queryString
		? `${ENDPOINTS.CASES.PHASE_HISTORY(id)}?${queryString}`
		: ENDPOINTS.CASES.PHASE_HISTORY(id);

	const response = await apiClient.get<{
		count: number;
		results: PhaseHistoryEntry[];
	}>(endpoint);

	return response.results;
};
