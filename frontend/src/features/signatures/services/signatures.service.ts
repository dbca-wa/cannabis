/**
 * Signature API service layer.
 *
 * Provides functions for managing digital signatures, including
 * CRUD operations, image retrieval, audit logs, and certificate signing.
 */

import { apiClient } from "@/shared/services/api";
import { API_CONFIG } from "@/shared/services/api/config";
import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import type { ServiceResult } from "@/shared/types/backend-api.types";
import type {
	Signature,
	SignatureAuditLogEntry,
} from "../types/signatures.types";
import { SIGNATURE_ENDPOINTS } from "./signatures.endpoints";

class SignaturesService {
	private generateRequestId(): string {
		return `signatures_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 8)}`;
	}

	/** Fetch the current user's signature metadata. */
	async getMySignature(): Promise<ServiceResult<Signature>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching current user signature", { requestId });

		try {
			const response = await apiClient.get<Signature>(SIGNATURE_ENDPOINTS.ME);
			logger.info("Signature fetched successfully", { requestId });
			return { data: response, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to fetch signature", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: {} as Signature,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Upload or replace the current user's signature image. */
	async uploadSignature(data: FormData): Promise<ServiceResult<Signature>> {
		const requestId = this.generateRequestId();
		logger.info("Uploading signature", { requestId });

		try {
			const response = await apiClient.post<Signature>(
				SIGNATURE_ENDPOINTS.ME,
				data,
				{ headers: { "Content-Type": "multipart/form-data" } }
			);
			logger.info("Signature uploaded successfully", { requestId });
			return { data: response, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to upload signature", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: {} as Signature,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Delete the current user's signature. */
	async deleteSignature(): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Deleting signature", { requestId });

		try {
			await apiClient.delete(SIGNATURE_ENDPOINTS.ME);
			logger.info("Signature deleted successfully", { requestId });
			return { data: undefined, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to delete signature", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Build the full URL for the current user's signature image (for use in <img> src). */
	getSignatureImageUrl(): string {
		return `${API_CONFIG.BASE_URL}${SIGNATURE_ENDPOINTS.ME_IMAGE}`;
	}

	/** Fetch a specific user's signature metadata (admin). */
	async getUserSignature(userId: number): Promise<ServiceResult<Signature>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching user signature", { userId, requestId });

		try {
			const response = await apiClient.get<Signature>(
				SIGNATURE_ENDPOINTS.USER(userId)
			);
			logger.info("User signature fetched successfully", {
				userId,
				requestId,
			});
			return { data: response, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to fetch user signature", {
				userId,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: {} as Signature,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Fetch the current user's signature audit log. */
	async getAuditLog(): Promise<ServiceResult<SignatureAuditLogEntry[]>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching signature audit log", { requestId });

		try {
			const response = await apiClient.get<SignatureAuditLogEntry[]>(
				SIGNATURE_ENDPOINTS.AUDIT
			);
			logger.info("Audit log fetched successfully", {
				count: response.length,
				requestId,
			});
			return { data: response, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to fetch audit log", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: [],
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Fetch a specific user's signature audit log (admin). */
	async getUserAuditLog(
		userId: number
	): Promise<ServiceResult<SignatureAuditLogEntry[]>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching user audit log", { userId, requestId });

		try {
			const response = await apiClient.get<SignatureAuditLogEntry[]>(
				SIGNATURE_ENDPOINTS.USER_AUDIT(userId)
			);
			logger.info("User audit log fetched successfully", {
				userId,
				count: response.length,
				requestId,
			});
			return { data: response, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to fetch user audit log", {
				userId,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: [],
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Sign a certificate with the current user's digital signature. */
	async signCertificate(
		submissionId: number,
		certificateId: number
	): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Signing certificate", {
			submissionId,
			certificateId,
			requestId,
		});

		try {
			await apiClient.post(
				SIGNATURE_ENDPOINTS.SIGN_CERTIFICATE(submissionId, certificateId)
			);
			logger.info("Certificate signed successfully", {
				submissionId,
				certificateId,
				requestId,
			});
			return { data: undefined, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to sign certificate", {
				submissionId,
				certificateId,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/** Unlock a certificate to allow unsigned PDF regeneration. */
	async unlockCertificate(
		submissionId: number,
		certificateId: number
	): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Unlocking certificate", {
			submissionId,
			certificateId,
			requestId,
		});

		try {
			await apiClient.post(
				SIGNATURE_ENDPOINTS.UNLOCK_CERTIFICATE(submissionId, certificateId)
			);
			logger.info("Certificate unlocked successfully", {
				submissionId,
				certificateId,
				requestId,
			});
			return { data: undefined, success: true };
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);
			logger.error("Failed to unlock certificate", {
				submissionId,
				certificateId,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});
			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}
}

export const signaturesService = new SignaturesService();
export { SignaturesService };
