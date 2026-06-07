/**
 * Shared module exports
 * Provides clean, tree-shakeable exports for the entire shared folder
 */

// Core utilities (most commonly used)
export { cn } from "./utils/style.utils";
export {
	getErrorMessage,
	normalizeError,
	isApiError,
	getAllErrorMessages,
	getFieldErrors,
} from "./utils/error.utils";
export { generateUUID, generateRequestId } from "./utils/uuid";

// Constants (essential only)
export { HTTP_STATUS, CONTENT_TYPES, SEARCH } from "./constants/api.constants";
export {
	AUTH_ROUTES,
	ERROR_ROUTES,
	ROUTE_HELPERS,
} from "./constants/routes.constants";

// Services (re-export from their index files)
export { logger } from "./services/logger.service";
export { storage } from "./services/storage.service";
export { apiClient, ENDPOINTS } from "./services/api";

// Types (re-export commonly used types)
export type {
	ServiceResult,
	User,
	AuthResponse,
	UserPreferences,
} from "./types/backend-api.types";

// Components (re-export from component index)
export * from "./components";

// Note: Hooks are not re-exported here to avoid circular dependencies
