import { logger } from "@/shared/services/logger.service";
import { storage } from "@/shared/services/storage.service";
import type { UserPreferences } from "@/shared/types/backend-api.types";
import { UserPreferencesService } from "@/features/user/services/userPreferences.service";

/**
 * Preferences Synchronization Service
 * Handles client-server sync logic, conflict resolution, and migration
 */
export class PreferencesSyncService {
	private static readonly MIGRATION_KEY = "preferences-migrated-to-server";
	private static readonly LAST_SYNC_KEY = "preferences-last-sync";

	/**
	 * Load preferences on login with localStorage fallback
	 */
	static async loadPreferencesOnLogin(): Promise<UserPreferences | null> {
		try {
			logger.info("Loading user preferences on login");

			// Try to fetch from server first
			logger.info("🔄 Fetching preferences from server...");
			const serverPreferences =
				await UserPreferencesService.getPreferences();

			logger.info("📥 Server preferences received", {
				serverPreferences,
				type: typeof serverPreferences,
				keys: serverPreferences
					? Object.keys(serverPreferences)
					: "null",
			});

			// Validate server preferences
			if (!serverPreferences) {
				throw new Error("Server returned null/undefined preferences");
			}

			// Always check for localStorage preferences that need to be migrated
			// This handles cases where user made changes while logged out
			const migratedPreferences = await this.migrateLocalStorageToServer(
				serverPreferences
			);

			// Use migrated preferences if they were updated, otherwise use server preferences
			const finalPreferences = migratedPreferences || serverPreferences;

			// Check if this is the first time loading server preferences
			const hasBeenMigrated = storage.getItem<boolean>(
				this.MIGRATION_KEY
			);

			if (!hasBeenMigrated) {
				// Mark as migrated to avoid showing first-time notifications
				storage.setItem(this.MIGRATION_KEY, true);
			}

			// Update last sync timestamp
			storage.setItem(this.LAST_SYNC_KEY, Date.now());

			logger.info("Preferences loaded successfully from server", {
				theme: finalPreferences.theme,
				loader: finalPreferences.loader_style,
				wasMigrated: !!migratedPreferences,
			});

			return finalPreferences;
		} catch (error) {
			logger.error(
				"Failed to load preferences from server, using localStorage fallback",
				{ error }
			);

			// Fallback to localStorage preferences
			return this.getLocalStorageFallback();
		}
	}

	/**
	 * Migrate existing localStorage preferences to server
	 */
	private static async migrateLocalStorageToServer(
		serverPreferences: UserPreferences | null
	): Promise<UserPreferences | null> {
		try {
			logger.info("Migrating localStorage preferences to server", {
				hasServerPreferences: !!serverPreferences,
				serverPreferences,
			});

			// If no server preferences, skip migration
			if (!serverPreferences) {
				logger.warn(
					"No server preferences available, skipping migration"
				);
				return null;
			}

			// Get current localStorage values
			const localTheme = storage.getItem<string>("cannabis-theme");
			const localLoader = storage.getItem<string>("cannabis-loader");

			// Build migration data
			const migrationData: Partial<UserPreferences> = {};
			let hasChanges = false;

			logger.info("Checking for preferences to migrate", {
				localTheme,
				serverTheme: serverPreferences.theme,
				localLoader,
				serverLoader: serverPreferences.loader_style,
			});

			// Migrate theme if different from server default
			if (localTheme && localTheme !== serverPreferences.theme) {
				migrationData.theme = localTheme as UserPreferences["theme"];
				hasChanges = true;
				logger.info("🔄 Migrating theme preference", {
					local: localTheme,
					server: serverPreferences.theme,
				});
			}

			// Migrate loader style if different from server default
			if (localLoader && localLoader !== serverPreferences.loader_style) {
				migrationData.loader_style =
					localLoader as UserPreferences["loader_style"];
				hasChanges = true;
				logger.info("🔄 Migrating loader preference", {
					local: localLoader,
					server: serverPreferences.loader_style,
				});
			}



			// Update server if we have changes to migrate
			if (hasChanges) {
				logger.info(
					"💾 Updating server with migrated preferences",
					migrationData
				);
				const updatedPreferences =
					await UserPreferencesService.updatePreferences(
						migrationData
					);
				logger.info("✅ Successfully migrated preferences to server", {
					sent: migrationData,
					result: updatedPreferences,
				});

				// Return the updated preferences so they get applied
				return updatedPreferences;
			} else {
				logger.info(
					"ℹ️ No preferences to migrate - localStorage matches server"
				);
			}

			return null; // No migration needed
		} catch (error) {
			logger.error("Failed to migrate preferences to server", { error });
			// Don't throw - continue with server preferences even if migration fails
			return null;
		}
	}

	/**
	 * Get localStorage fallback preferences
	 */
	private static getLocalStorageFallback(): UserPreferences | null {
		try {
			const localTheme =
				storage.getItem<string>("cannabis-theme") || "system";
			const localLoader =
				storage.getItem<string>("cannabis-loader") || "minimal";
			// Create a minimal preferences object from localStorage
			const fallbackPreferences: Partial<UserPreferences> = {
				theme: localTheme as UserPreferences["theme"],
				loader_style: localLoader as UserPreferences["loader_style"],
				ui_preferences: {},
			};

			logger.info(
				"Using localStorage fallback preferences",
				fallbackPreferences
			);
			return fallbackPreferences as UserPreferences;
		} catch (error) {
			logger.error("Failed to load localStorage fallback", { error });
			return null;
		}
	}

	/**
	 * Handle sync conflicts with user choice or timestamp priority
	 */
	static async handleSyncConflict(
		localPreferences: Partial<UserPreferences>,
		serverPreferences: UserPreferences,
		strategy:
			| "user_choice"
			| "timestamp"
			| "server_wins"
			| "local_wins" = "server_wins"
	): Promise<UserPreferences> {
		logger.info("Handling preference sync conflict", { strategy });

		switch (strategy) {
			case "server_wins":
				// Server preferences take priority (default behavior)
				return serverPreferences;

			case "local_wins": // Local preferences take priority
			{
				const updatedPreferences =
					await UserPreferencesService.updatePreferences(
						localPreferences
					);
				return updatedPreferences;
			}

			case "timestamp": {
				// Use timestamp to determine which is newer
				const lastSync = storage.getItem<number>(this.LAST_SYNC_KEY);
				const serverUpdated = new Date(
					serverPreferences.updated_at || 0
				).getTime();

				if (lastSync && lastSync > serverUpdated) {
					// Local changes are newer
					return this.handleSyncConflict(
						localPreferences,
						serverPreferences,
						"local_wins"
					);
				} else {
					// Server changes are newer
					return this.handleSyncConflict(
						localPreferences,
						serverPreferences,
						"server_wins"
					);
				}
			}

			case "user_choice":
				// This would require UI interaction - for now, default to server wins
				// In a full implementation, this would show a modal asking the user
				logger.info(
					"User choice conflict resolution not implemented, defaulting to server"
				);
				return this.handleSyncConflict(
					localPreferences,
					serverPreferences,
					"server_wins"
				);

			default:
				return serverPreferences;
		}
	}

	/**
	 * Check if preferences need synchronization
	 */
	static needsSync(): boolean {
		const lastSync = storage.getItem<number>(this.LAST_SYNC_KEY);
		if (!lastSync) return true;

		// Sync if it's been more than 5 minutes since last sync
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
		return lastSync < fiveMinutesAgo;
	}

	/**
	 * Force sync preferences to server
	 */
	static async forceSyncToServer(
		preferences: Partial<UserPreferences>
	): Promise<void> {
		try {
			await UserPreferencesService.updatePreferences(preferences);
			storage.setItem(this.LAST_SYNC_KEY, Date.now());
			logger.info("Forced sync to server completed", preferences);
		} catch (error) {
			logger.error("Failed to force sync to server", {
				error,
				preferences,
			});
			throw error;
		}
	}

	/**
	 * Clear migration and sync state (for testing/reset)
	 */
	static clearSyncState(): void {
		storage.removeItem(this.MIGRATION_KEY);
		storage.removeItem(this.LAST_SYNC_KEY);
		logger.info("Sync state cleared");
	}
}
