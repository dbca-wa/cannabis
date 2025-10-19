import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type { UserPreferences } from "@/shared/types/backend-api.types";

/**
 * User Preferences Service
 * Handles API communication for user preference synchronization
 */
export class UserPreferencesService {
	/**
	 * Get current user's preferences from server
	 */
	static async getPreferences(): Promise<UserPreferences> {
		try {
			const response = await apiClient.get<UserPreferences>(
				ENDPOINTS.USERS.PREFERENCES
			);

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Update current user's preferences on server
	 */
	static async updatePreferences(
		preferences: Partial<UserPreferences>
	): Promise<UserPreferences> {
		const response = await apiClient.patch<UserPreferences>(
			ENDPOINTS.USERS.PREFERENCES,
			preferences
		);
		return response;
	}

	/**
	 * Update theme preference only
	 */
	static async updateTheme(
		theme: UserPreferences["theme"]
	): Promise<UserPreferences> {
		return this.updatePreferences({ theme });
	}

	/**
	 * Update loader style preference only
	 */
	static async updateLoaderStyle(
		loader_style: UserPreferences["loader_style"]
	): Promise<UserPreferences> {
		return this.updatePreferences({ loader_style });
	}



	/**
	 * Update UI preferences only
	 */
	static async updateUIPreferences(
		ui_preferences: UserPreferences["ui_preferences"]
	): Promise<UserPreferences> {
		return this.updatePreferences({ ui_preferences });
	}

	/**
	 * Update table filter preferences only
	 */
	static async updateTableFilterPreferences(
		table_filter_preferences: UserPreferences["table_filter_preferences"]
	): Promise<UserPreferences> {
		return this.updatePreferences({ table_filter_preferences });
	}

	/**
	 * Update specific table filter preferences (officers, stations, users)
	 */
	static async updateSpecificTableFilters(
		tableName: string,
		filters: Record<string, unknown>
	): Promise<UserPreferences> {
		// Get current preferences first
		const currentPrefs = await this.getPreferences();
		const currentTablePrefs = currentPrefs.table_filter_preferences || {};

		// Update specific table preferences
		const updatedTablePrefs = {
			...currentTablePrefs,
			[tableName]: {
				...(currentTablePrefs[tableName] || {}),
				...filters,
			},
		};

		return this.updateTableFilterPreferences(updatedTablePrefs);
	}
}
