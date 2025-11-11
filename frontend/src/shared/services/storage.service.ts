import { logger } from "./logger.service";
import { STORAGE_CONFIG } from "@/app/config/storage.config";
import { getErrorMessage } from "@/shared/utils/error.utils";

interface StorageOptions {
	encrypt?: boolean;
	ttl?: number; // Time to live in milliseconds
	compress?: boolean;
}

interface StorageItem<T = unknown> {
	value: T;
	timestamp: number;
	ttl?: number;
	encrypted?: boolean;
	version?: string;
}

// Type for storage info response
interface StorageInfo {
	localStorageSize: number;
	sessionStorageSize: number;
	localStorageKeys: string[];
	sessionStorageKeys: string[];
	totalItems: number;
	expiredItems: number;
}

// Type for cleanup item tracking
interface StorageItemInfo {
	key: string;
	timestamp: number;
	size: number;
}

class StorageService {
	private encryptionKey: string | null = null;

	constructor() {
		this.initialiseEncryption();
		this.startCleanupTimer();
	}

	private initialiseEncryption(): void {
		// Use encryption key from config
		this.encryptionKey = STORAGE_CONFIG.SECURITY.ENCRYPTION_KEY;
	}

	private startCleanupTimer(): void {
		if (STORAGE_CONFIG.CLEANUP.ENABLED) {
			setInterval(() => {
				this.cleanupExpiredItems();
			}, STORAGE_CONFIG.CLEANUP.INTERVAL);
		}
	}

	private isExpired(item: StorageItem): boolean {
		if (!item.ttl) return false;
		return Date.now() - item.timestamp > item.ttl;
	}

	private encrypt(value: string): string {
		if (
			!this.encryptionKey ||
			!STORAGE_CONFIG.SECURITY.ENCRYPT_SENSITIVE_DATA
		) {
			return value;
		}

		try {
			// Simple XOR encryption (upgrade to AES in production)
			let encrypted = "";
			for (let i = 0; i < value.length; i++) {
				encrypted += String.fromCharCode(
					value.charCodeAt(i) ^
						this.encryptionKey.charCodeAt(
							i % this.encryptionKey.length
						)
				);
			}
			return btoa(encrypted);
		} catch (error: unknown) {
			logger.error("Encryption failed", {
				error: getErrorMessage(error),
			});
			return value;
		}
	}

	private decrypt(encryptedValue: string): string {
		if (
			!this.encryptionKey ||
			!STORAGE_CONFIG.SECURITY.ENCRYPT_SENSITIVE_DATA
		) {
			return encryptedValue;
		}

		try {
			const decoded = atob(encryptedValue);
			let decrypted = "";
			for (let i = 0; i < decoded.length; i++) {
				decrypted += String.fromCharCode(
					decoded.charCodeAt(i) ^
						this.encryptionKey.charCodeAt(
							i % this.encryptionKey.length
						)
				);
			}
			return decrypted;
		} catch (error: unknown) {
			logger.error("Decryption failed", {
				error: getErrorMessage(error),
			});
			return encryptedValue;
		}
	}

	private getStorageKey(
		key: string,
		prefix: string = STORAGE_CONFIG.STORAGE_TYPES.LOCAL.PREFIX
	): string {
		return `${prefix}${key}`;
	}

	private checkStorageSize(storage: Storage): boolean {
		const currentSize = this.getStorageSize(storage);
		const maxSize = STORAGE_CONFIG.STORAGE_TYPES.LOCAL.MAX_SIZE;

		if (currentSize > maxSize) {
			logger.warn("Storage size exceeded", { currentSize, maxSize });
			return false;
		}
		return true;
	}

	private getStorageSize(storage: Storage): number {
		let size = 0;
		for (let i = 0; i < storage.length; i++) {
			const key = storage.key(i);
			if (key) {
				const value = storage.getItem(key);
				if (value) {
					size += key.length + value.length;
				}
			}
		}
		return size;
	}

	// Enhanced Local Storage methods
	setItem<T>(key: string, value: T, options: StorageOptions = {}): void {
		try {
			const storageKey = this.getStorageKey(key);
			const config = STORAGE_CONFIG.STORAGE_TYPES.LOCAL;

			// Check storage size before adding
			if (!this.checkStorageSize(localStorage)) {
				this.performCleanup();
			}

			const item: StorageItem<T> = {
				value,
				timestamp: Date.now(),
				ttl: options.ttl,
				encrypted: options.encrypt || config.ENCRYPTION,
				version: STORAGE_CONFIG.MIGRATION.CURRENT_VERSION,
			};

			let serialized = JSON.stringify(item);

			if (item.encrypted) {
				serialized = this.encrypt(serialized);
			}

			localStorage.setItem(storageKey, serialized);

			logger.debug("Item stored", {
				key: storageKey,
				hasExpiry: !!options.ttl,
				encrypted: item.encrypted,
				size: serialized.length,
			});
		} catch (error: unknown) {
			logger.error("Failed to store item", {
				key,
				error: getErrorMessage(error),
			});

			// Handle quota exceeded error
			if (
				error instanceof DOMException &&
				error.name === "QuotaExceededError"
			) {
				this.performCleanup();
				// Retry once after cleanup
				this.retrySetItem(key, value, options);
			}
		}
	}

	private retrySetItem<T>(
		key: string,
		value: T,
		options: StorageOptions
	): void {
		try {
			const storageKey = this.getStorageKey(key);
			const item: StorageItem<T> = {
				value,
				timestamp: Date.now(),
				ttl: options.ttl,
				encrypted: options.encrypt,
			};
			localStorage.setItem(storageKey, JSON.stringify(item));
			logger.info("Item stored after cleanup", { key: storageKey });
		} catch (retryError: unknown) {
			logger.error("Failed to store item after cleanup", {
				key,
				error: getErrorMessage(retryError),
			});
		}
	}

	getItem<T>(key: string): T | null {
		try {
			const storageKey = this.getStorageKey(key);
			const stored = localStorage.getItem(storageKey);
			if (!stored) return null;

			let item: StorageItem<T>;

			try {
				// Try to parse as JSON first
				item = JSON.parse(stored) as StorageItem<T>;
			} catch {
				// If parsing fails, try to decrypt first
				const decrypted = this.decrypt(stored);
				item = JSON.parse(decrypted) as StorageItem<T>;
			}

			// Check version compatibility
			if (
				item.version &&
				item.version !== STORAGE_CONFIG.MIGRATION.CURRENT_VERSION
			) {
				logger.warn("Storage version mismatch", {
					key: storageKey,
					stored: item.version,
					current: STORAGE_CONFIG.MIGRATION.CURRENT_VERSION,
				});

				if (STORAGE_CONFIG.MIGRATION.AUTO_MIGRATE) {
					// Could implement migration logic here
					logger.info("Auto-migrating storage item", {
						key: storageKey,
					});
				}
			}

			// Check if item is expired
			if (this.isExpired(item)) {
				this.removeItem(key);
				logger.debug("Expired item removed", { key: storageKey });
				return null;
			}

			return item.value;
		} catch (error: unknown) {
			logger.error("Failed to retrieve item", {
				key,
				error: getErrorMessage(error),
			});
			return null;
		}
	}

	removeItem(key: string): void {
		try {
			const storageKey = this.getStorageKey(key);
			localStorage.removeItem(storageKey);
			logger.debug("Item removed", { key: storageKey });
		} catch (error: unknown) {
			logger.error("Failed to remove item", {
				key,
				error: getErrorMessage(error),
			});
		}
	}

	// Enhanced Session Storage methods
	setSessionItem<T>(
		key: string,
		value: T,
		options: StorageOptions = {}
	): void {
		try {
			const storageKey = this.getStorageKey(
				key,
				STORAGE_CONFIG.STORAGE_TYPES.SESSION.PREFIX
			);
			const config = STORAGE_CONFIG.STORAGE_TYPES.SESSION;

			const item: StorageItem<T> = {
				value,
				timestamp: Date.now(),
				ttl: options.ttl,
				encrypted: options.encrypt || config.ENCRYPTION,
				version: STORAGE_CONFIG.MIGRATION.CURRENT_VERSION,
			};

			let serialized = JSON.stringify(item);

			if (item.encrypted) {
				serialized = this.encrypt(serialized);
			}

			sessionStorage.setItem(storageKey, serialized);

			logger.debug("Session item stored", {
				key: storageKey,
				hasExpiry: !!options.ttl,
				encrypted: item.encrypted,
			});
		} catch (error: unknown) {
			logger.error("Failed to store session item", {
				key,
				error: getErrorMessage(error),
			});
		}
	}

	getSessionItem<T>(key: string): T | null {
		try {
			const storageKey = this.getStorageKey(
				key,
				STORAGE_CONFIG.STORAGE_TYPES.SESSION.PREFIX
			);
			const stored = sessionStorage.getItem(storageKey);
			if (!stored) return null;

			let item: StorageItem<T>;

			try {
				item = JSON.parse(stored) as StorageItem<T>;
			} catch {
				const decrypted = this.decrypt(stored);
				item = JSON.parse(decrypted) as StorageItem<T>;
			}

			if (this.isExpired(item)) {
				this.removeSessionItem(key);
				logger.debug("Expired session item removed", {
					key: storageKey,
				});
				return null;
			}

			return item.value;
		} catch (error: unknown) {
			logger.error("Failed to retrieve session item", {
				key,
				error: getErrorMessage(error),
			});
			return null;
		}
	}

	removeSessionItem(key: string): void {
		try {
			const storageKey = this.getStorageKey(
				key,
				STORAGE_CONFIG.STORAGE_TYPES.SESSION.PREFIX
			);
			sessionStorage.removeItem(storageKey);
			logger.debug("Session item removed", { key: storageKey });
		} catch (error: unknown) {
			logger.error("Failed to remove session item", {
				key,
				error: getErrorMessage(error),
			});
		}
	}

	// Enhanced utility methods
	clear(): void {
		try {
			localStorage.clear();
			sessionStorage.clear();
			logger.info("All storage cleared");
		} catch (error: unknown) {
			logger.error("Failed to clear storage", {
				error: getErrorMessage(error),
			});
		}
	}

	getStorageInfo(): StorageInfo {
		try {
			const localStorageKeys = Object.keys(localStorage);
			const sessionStorageKeys = Object.keys(sessionStorage);

			let localStorageSize = 0;
			let sessionStorageSize = 0;
			let expiredItems = 0;

			localStorageKeys.forEach((key) => {
				const value = localStorage.getItem(key);
				if (value) {
					localStorageSize += key.length + value.length;

					// Check if item is expired
					try {
						const item = JSON.parse(value) as StorageItem;
						if (this.isExpired(item)) {
							expiredItems++;
						}
					} catch {
						// Not a structured item, skip
					}
				}
			});

			sessionStorageKeys.forEach((key) => {
				const value = sessionStorage.getItem(key);
				if (value) {
					sessionStorageSize += key.length + value.length;
				}
			});

			return {
				localStorageSize,
				sessionStorageSize,
				localStorageKeys,
				sessionStorageKeys,
				totalItems: localStorageKeys.length + sessionStorageKeys.length,
				expiredItems,
			};
		} catch (error: unknown) {
			logger.error("Failed to get storage info", {
				error: getErrorMessage(error),
			});
			return {
				localStorageSize: 0,
				sessionStorageSize: 0,
				localStorageKeys: [],
				sessionStorageKeys: [],
				totalItems: 0,
				expiredItems: 0,
			};
		}
	}

	// Enhanced cleanup with configuration
	cleanupExpiredItems(): void {
		if (!STORAGE_CONFIG.CLEANUP.EXPIRED_CLEANUP) return;

		try {
			const localKeys = Object.keys(localStorage);
			const sessionKeys = Object.keys(sessionStorage);

			let cleanedCount = 0;

			// Clean localStorage
			localKeys.forEach((key) => {
				if (key.startsWith(STORAGE_CONFIG.STORAGE_TYPES.LOCAL.PREFIX)) {
					const rawKey = key.substring(
						STORAGE_CONFIG.STORAGE_TYPES.LOCAL.PREFIX.length
					);
					const item = this.getItem(rawKey);
					if (item === null) cleanedCount++;
				}
			});

			// Clean sessionStorage
			sessionKeys.forEach((key) => {
				if (
					key.startsWith(STORAGE_CONFIG.STORAGE_TYPES.SESSION.PREFIX)
				) {
					const rawKey = key.substring(
						STORAGE_CONFIG.STORAGE_TYPES.SESSION.PREFIX.length
					);
					const item = this.getSessionItem(rawKey);
					if (item === null) cleanedCount++;
				}
			});

			if (cleanedCount > 0) {
				logger.info("Cleaned up expired storage items", {
					count: cleanedCount,
				});
			}
		} catch (error: unknown) {
			logger.error("Failed to cleanup expired items", {
				error: getErrorMessage(error),
			});
		}
	}

	private performCleanup(): void {
		logger.info("Performing storage cleanup");

		// Clean expired items first
		this.cleanupExpiredItems();

		// If still over limit, remove oldest items
		if (STORAGE_CONFIG.CLEANUP.SIZE_LIMIT_CLEANUP) {
			const currentSize = this.getStorageSize(localStorage);
			const maxSize = STORAGE_CONFIG.STORAGE_TYPES.LOCAL.MAX_SIZE;

			if (currentSize > maxSize) {
				logger.warn("Storage still over limit, removing oldest items");
				this.removeOldestItems(Math.floor(maxSize * 0.1)); // Remove 10% of max size
			}
		}
	}

	private removeOldestItems(bytesToRemove: number): void {
		const items: StorageItemInfo[] = [];

		// Collect all items with timestamps
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (
				key &&
				key.startsWith(STORAGE_CONFIG.STORAGE_TYPES.LOCAL.PREFIX)
			) {
				const value = localStorage.getItem(key);
				if (value) {
					try {
						const item = JSON.parse(value) as StorageItem;
						if (item.timestamp) {
							items.push({
								key,
								timestamp: item.timestamp,
								size: key.length + value.length,
							});
						}
					} catch {
						// Invalid format, mark for removal
						items.push({
							key,
							timestamp: 0,
							size: key.length + value.length,
						});
					}
				}
			}
		}

		// Sort by timestamp (oldest first)
		items.sort((a, b) => a.timestamp - b.timestamp);

		// Remove items until we've freed enough space
		let removedSize = 0;
		for (const item of items) {
			if (removedSize >= bytesToRemove) break;

			localStorage.removeItem(item.key);
			removedSize += item.size;
			logger.debug("Removed old storage item", {
				key: item.key,
				size: item.size,
			});
		}

		logger.info("Cleanup completed", {
			removedSize,
			itemsRemoved: items.length,
		});
	}

	// Typed convenience methods using storage config keys


	setTheme(theme: string): void {
		this.setItem(STORAGE_CONFIG.KEYS.THEME, theme, {
			ttl: STORAGE_CONFIG.TTL.THEME_SETTINGS,
		});
	}

	getTheme(): string | null {
		return this.getItem<string>(STORAGE_CONFIG.KEYS.THEME);
	}



	// JWT Token management methods
	private readonly ACCESS_TOKEN_KEY = "cannabis_access_token";
	private readonly REFRESH_TOKEN_KEY = "cannabis_refresh_token";

	getAccessToken(): string | null {
		return this.getItem<string>(this.ACCESS_TOKEN_KEY);
	}

	getRefreshToken(): string | null {
		return this.getItem<string>(this.REFRESH_TOKEN_KEY);
	}

	setTokens(accessToken: string, refreshToken: string): void {
		this.setItem(this.ACCESS_TOKEN_KEY, accessToken, { encrypt: true });
		this.setItem(this.REFRESH_TOKEN_KEY, refreshToken, { encrypt: true });
	}

	clearTokens(): void {
		this.removeItem(this.ACCESS_TOKEN_KEY);
		this.removeItem(this.REFRESH_TOKEN_KEY);
	}

	hasValidTokens(): boolean {
		const accessToken = this.getAccessToken();
		const refreshToken = this.getRefreshToken();
		return !!(accessToken && refreshToken);
	}

	isTokenExpired(token: string): boolean {
		try {
			const payload = JSON.parse(atob(token.split(".")[1]));
			const currentTime = Date.now() / 1000;
			return payload.exp < currentTime;
		} catch {
			return true;
		}
	}

	shouldRefreshToken(): boolean {
		const accessToken = this.getAccessToken();
		if (!accessToken) return false;

		try {
			const payload = JSON.parse(atob(accessToken.split(".")[1]));
			const currentTime = Date.now() / 1000;
			const timeToExpiry = payload.exp - currentTime;

			// Refresh if token expires in less than 5 minutes
			return timeToExpiry < 300;
		} catch {
			return true;
		}
	}


}

export const storage = new StorageService();
