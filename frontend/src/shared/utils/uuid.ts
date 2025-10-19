/**
 * Browser-compatible UUID generation utility
 * Provides fallback methods for environments where crypto.randomUUID is not available
 */

import { logger } from "../services/logger.service";

export interface UUIDGenerator {
	generateUUID(): string;
	generateRequestId(prefix?: string): string;
}

class BrowserUUIDService implements UUIDGenerator {
	private static instance: BrowserUUIDService;

	public static getInstance(): BrowserUUIDService {
		if (!BrowserUUIDService.instance) {
			BrowserUUIDService.instance = new BrowserUUIDService();
		}
		return BrowserUUIDService.instance;
	}

	/**
	 * Generate a UUID using the best available method
	 */
	generateUUID(): string {
		try {
			// Method 1: Native crypto.randomUUID (most secure, modern browsers)
			if (this.isNativeCryptoUUIDAvailable()) {
				const uuid = crypto.randomUUID();
				logger.debug("Generated UUID using native crypto.randomUUID", {
					uuid,
				});
				return uuid;
			}

			// Method 2: crypto.getRandomValues with UUID v4 format (good fallback)
			if (this.isCryptoRandomValuesAvailable()) {
				const uuid = this.generateUUIDv4WithCrypto();
				logger.debug(
					"Generated UUID using crypto.getRandomValues fallback",
					{ uuid }
				);
				return uuid;
			}

			// Method 3: Math.random fallback (least secure but functional)
			const uuid = this.generateUUIDv4WithMath();
			logger.warn(
				"Generated UUID using Math.random fallback (less secure)",
				{ uuid }
			);
			return uuid;
		} catch (error) {
			logger.error(
				"All UUID generation methods failed, using emergency fallback",
				{ error }
			);
			return this.generateEmergencyUUID();
		}
	}

	/**
	 * Generate a request ID with optional prefix
	 */
	generateRequestId(prefix: string = "req"): string {
		const timestamp = Date.now();
		const randomPart = this.generateRandomString(6);
		const requestId = `${prefix}_${timestamp}_${randomPart}`;

		logger.debug("Generated request ID", { requestId, prefix, timestamp });
		return requestId;
	}

	/**
	 * Check if native crypto.randomUUID is available
	 */
	private isNativeCryptoUUIDAvailable(): boolean {
		return (
			typeof crypto !== "undefined" &&
			typeof crypto.randomUUID === "function"
		);
	}

	/**
	 * Check if crypto.getRandomValues is available
	 */
	private isCryptoRandomValuesAvailable(): boolean {
		return (
			typeof crypto !== "undefined" &&
			typeof crypto.getRandomValues === "function"
		);
	}

	/**
	 * Generate UUID v4 using crypto.getRandomValues
	 */
	private generateUUIDv4WithCrypto(): string {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);

		// Set version (4) and variant bits
		bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
		bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

		// Convert to hex string with hyphens
		const hex = Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		return [
			hex.slice(0, 8),
			hex.slice(8, 12),
			hex.slice(12, 16),
			hex.slice(16, 20),
			hex.slice(20, 32),
		].join("-");
	}

	/**
	 * Generate UUID v4 using Math.random (fallback)
	 */
	private generateUUIDv4WithMath(): string {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * Emergency UUID generation (timestamp + random)
	 */
	private generateEmergencyUUID(): string {
		const timestamp = Date.now().toString(16);
		const random = Math.random().toString(16).slice(2);
		return `emergency-${timestamp}-${random}`;
	}

	/**
	 * Generate a random string for request IDs
	 */
	private generateRandomString(length: number): string {
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";

		if (this.isCryptoRandomValuesAvailable()) {
			const bytes = new Uint8Array(length);
			crypto.getRandomValues(bytes);
			for (let i = 0; i < length; i++) {
				result += chars[bytes[i] % chars.length];
			}
		} else {
			for (let i = 0; i < length; i++) {
				result += chars[Math.floor(Math.random() * chars.length)];
			}
		}

		return result;
	}
}

// Export singleton instance
export const uuidService = BrowserUUIDService.getInstance();

// Export convenience functions
export const generateUUID = () => uuidService.generateUUID();
export const generateRequestId = (prefix?: string) =>
	uuidService.generateRequestId(prefix);
