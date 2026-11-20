export const LEGACY_IMPORT_ENDPOINTS = {
	BUNDLE: () => `/cases/legacy-import/bundle`,
	RUNS: () => `/cases/legacy-import/runs`,
	RUN: (id: number) => `/cases/legacy-import/runs/${id}`,
} as const;
