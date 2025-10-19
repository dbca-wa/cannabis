// ============================================================================
// ORGANIZED TYPE EXPORTS
// ============================================================================

// Core shared patterns and utilities
export * from "./common.types";

// Domain-specific type modules (organized by business domain)
export * from "./auth.types"; // Authentication, users, and preferences
export * from "./users.types"; // Police officers, defendants, and roles
export * from "./submissions.types"; // Submission workflow and drug bags
export * from "./certificates.types"; // Certificates, invoices, and fees
export * from "./loader.types";

// Re-export all types from backend-api.types.ts for backward compatibility
// TODO: Remove this in a future major version after migration period
export * from "./backend-api.types";
