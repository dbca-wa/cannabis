import { apiClient, ENDPOINTS } from "./api";
import type {
	SystemSettings,
	FeatureFlags,
} from "@/shared/types/backend-api.types";

export class SystemSettingsService {
	static async getSettings(): Promise<SystemSettings> {
		return await apiClient.get<SystemSettings>(ENDPOINTS.SYSTEM.SETTINGS);
	}

	/** Lightweight feature flags readable by any app user. */
	static async getFeatureFlags(): Promise<FeatureFlags> {
		return await apiClient.get<FeatureFlags>(ENDPOINTS.SYSTEM.FEATURE_FLAGS);
	}
}
