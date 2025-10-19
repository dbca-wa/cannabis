import { apiClient, ENDPOINTS } from "./api";
import type { SystemSettings } from "@/shared/types/backend-api.types";

export class SystemSettingsService {
	static async getSettings(): Promise<SystemSettings> {
		return await apiClient.get<SystemSettings>(ENDPOINTS.SYSTEM.SETTINGS);
	}
}
