/**
 * Digital signature types for the signatures feature.
 *
 * Represents the data structures returned by the signatures API,
 * including signature metadata, audit log entries, and upload requests.
 */

/** Stored digital signature metadata for an Approved Botanist. */
export interface Signature {
	id: number;
	user: number;
	content_type: "image/png" | "image/svg+xml";
	file_size: number;
	width: number | null;
	height: number | null;
	file_hash: string;
	image_url: string;
	created_at: string;
	updated_at: string;
}

/** A single entry in the signature audit trail. */
export interface SignatureAuditLogEntry {
	id: number;
	user: number;
	actor: number;
	actor_name: string;
	action: "upload" | "update" | "delete" | "sign" | "integrity_failure";
	timestamp: string;
	content_type: string | null;
	file_size: number | null;
	file_hash: string | null;
}

/** Upload request payload — multipart form data with an "image" field. */
export type SignatureUploadRequest = FormData;
