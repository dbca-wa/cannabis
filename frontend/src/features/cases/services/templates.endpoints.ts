/**
 * Section C template API endpoint constants.
 */
export const TEMPLATE_ENDPOINTS = {
	LIST: "/cases/templates",
	DETAIL: (pk: number) => `/cases/templates/${pk}`,
} as const;
