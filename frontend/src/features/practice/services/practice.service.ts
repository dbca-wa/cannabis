/**
 * Practice mode API service functions.
 */
import { apiClient } from "@/shared/services/api";
import { PRACTICE_ENDPOINTS } from "./practice.endpoints";
import type { IPracticeModeState } from "../types/practice.types";

/** Turn practice mode on for the current user. */
export const enablePracticeMode = async (): Promise<IPracticeModeState> => {
	return apiClient.post<IPracticeModeState>(PRACTICE_ENDPOINTS.MODE, {});
};

/**
 * Turn practice mode off. The user's practice data is kept (hidden from the live
 * application) and shown again next time they enter practice mode.
 */
export const disablePracticeMode = async (): Promise<IPracticeModeState> => {
	return apiClient.delete<IPracticeModeState>(PRACTICE_ENDPOINTS.MODE);
};

/** Clear the user's practice data and start a fresh practice session. */
export const resetPracticeData = async (): Promise<IPracticeModeState> => {
	return apiClient.post<IPracticeModeState>(PRACTICE_ENDPOINTS.RESET, {});
};
