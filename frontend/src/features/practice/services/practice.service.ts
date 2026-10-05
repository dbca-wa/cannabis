/**
 * Practice mode API service functions.
 */
import { apiClient } from "@/shared/services/api";
import { PRACTICE_ENDPOINTS } from "./practice.endpoints";
import type {
	IPracticeBrief,
	IPracticeModeState,
} from "../types/practice.types";

/** Turn practice mode on for the current user. */
export const enablePracticeMode = async (): Promise<IPracticeModeState> => {
	return apiClient.post<IPracticeModeState>(PRACTICE_ENDPOINTS.MODE, {});
};

/** Turn practice mode off and delete the user's practice data. */
export const disablePracticeMode = async (): Promise<IPracticeModeState> => {
	return apiClient.delete<IPracticeModeState>(PRACTICE_ENDPOINTS.MODE);
};

/** Fetch a fresh fake brief to work through on the case page. */
export const getPracticeBrief = async (): Promise<IPracticeBrief> => {
	return apiClient.get<IPracticeBrief>(PRACTICE_ENDPOINTS.BRIEF);
};
