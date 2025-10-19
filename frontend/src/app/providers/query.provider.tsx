import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type ReactNode } from "react";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage, isApiError } from "@/shared/utils/error.utils";

interface QueryProviderProps {
	children: ReactNode;
}

// error detection
function getErrorStatus(error: unknown): number | null {
	// Check if it's an API error first
	if (isApiError(error)) {
		return error.status;
	}

	// Check for direct status property
	if (error && typeof error === "object" && "status" in error) {
		const status = (error as { status: unknown }).status;
		return typeof status === "number" ? status : null;
	}

	// Check for response.status property
	if (
		error &&
		typeof error === "object" &&
		"response" in error &&
		error.response &&
		typeof error.response === "object" &&
		"status" in error.response
	) {
		const status = (error.response as { status: unknown }).status;
		return typeof status === "number" ? status : null;
	}

	return null;
}

function isAuthError(error: unknown): boolean {
	const status = getErrorStatus(error);
	if (status === 401 || status === 403) {
		return true;
	}

	// Check error messages as fallback
	const message = getErrorMessage(error).toLowerCase();
	return (
		message.includes("401") ||
		message.includes("403") ||
		message.includes("unauthorized") ||
		message.includes("forbidden") ||
		message.includes("not authenticated")
	);
}

// Create React Query client with optimised settings
const createQueryClient = () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 5 * 60 * 1000, // 5 minutes
				gcTime: 10 * 60 * 1000, // 10 minutes (fka cacheTime)
				// retry logic for all queries
				retry: (failureCount: number, error: Error) => {
					const status = getErrorStatus(error);

					// Don't retry any 4xx client errors (they won't succeed on retry)
					if (status && status >= 400 && status < 500) {
						logger.debug("Skipping retry for client error", {
							status,
							error: getErrorMessage(error),
						});
						return false;
					}

					// Only retry server errors (5xx) and network errors, max 2 times
					const shouldRetry = failureCount < 2;

					if (shouldRetry) {
						logger.debug("Retrying query", {
							attempt: failureCount + 1,
							maxAttempts: 2,
							error: getErrorMessage(error),
						});
					} else {
						logger.warn("Max retries reached", {
							attempts: failureCount + 1,
							error: getErrorMessage(error),
						});
					}

					return shouldRetry;
				},
				refetchOnWindowFocus: false,
				refetchOnReconnect: true,
			},
			mutations: {
				retry: 1,
				onError: (error: Error) => {
					logger.error("Mutation error", {
						error: getErrorMessage(error),
						details: error,
					});
				},
			},
		},
	});

	// Auth-specific mutation defaults
	client.setMutationDefaults(["auth"], {
		retry: (failureCount: number, error: Error) => {
			// Don't retry auth errors - they're usually intentional
			return !isAuthError(error) && failureCount < 1;
		},
		onError: (error: Error) => {
			if (isAuthError(error)) {
				logger.debug("Auth mutation failed with auth error", {
					error: getErrorMessage(error),
				});
			} else {
				logger.error("Auth mutation error", {
					error: getErrorMessage(error),
					details: error,
				});
			}
		},
	});

	// Auth query defaults - applies to all auth-related queries
	const authQueryDefaults = {
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		retry: false, // Never retry auth queries
		refetchOnWindowFocus: false,
	};

	client.setQueryDefaults(["auth"], authQueryDefaults);
	client.setQueryDefaults(["auth", "user"], authQueryDefaults);

	return client;
};

// Singleton query client
const queryClient = createQueryClient();

export const QueryProvider = ({ children }: QueryProviderProps) => {
	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{/* Only show devtools in development */}
			{import.meta.env.DEV && (
				<ReactQueryDevtools initialIsOpen={false} />
			)}
		</QueryClientProvider>
	);
};

// Query client is available via useQueryClient() hook
