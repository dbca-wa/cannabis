import { useQuery } from "@tanstack/react-query";
import { SystemSettingsService } from "@/shared/services";

/**
 * Reads lightweight system flags and defaults (OCR enablement, the default
 * botanist). Unlike full system settings, which are admin-only, these are
 * readable by any app user, so the case creation and processing flows can act
 * on them.
 */
export const useFeatureFlags = () => {
	return useQuery({
		queryKey: ["system", "feature-flags"],
		queryFn: () => SystemSettingsService.getFeatureFlags(),
		staleTime: 60_000,
	});
};

/** Convenience selector — whether the OCR upload feature is enabled. */
export const useOcrEnabled = (): boolean => {
	const { data } = useFeatureFlags();
	return data?.ocr_enabled ?? false;
};

/**
 * Whether list pages may remember a user's search between visits. Off unless an
 * admin has turned it on system-wide, so a saved search never hides a record a
 * user has just created.
 */
export const useSavedSearchesAllowed = (): boolean => {
	const { data } = useFeatureFlags();
	return data?.allow_saved_searches ?? false;
};

/**
 * The botanist to pre-select on a new case, or null when no default is set or
 * the configured user no longer holds the role.
 */
export const useDefaultBotanistId = (): number | null => {
	const { data } = useFeatureFlags();
	return data?.default_approved_botanist ?? null;
};

/** Certificate print options to pre-tick on a new case. */
export interface CertificatePrintDefaults {
	print_conveying_station: boolean;
	print_requesting_station: boolean;
	print_requesting_rank: boolean;
}

/** The backend's initial defaults, used until the flags have loaded. */
export const INITIAL_PRINT_DEFAULTS: CertificatePrintDefaults = {
	print_conveying_station: true,
	print_requesting_station: true,
	print_requesting_rank: false,
};

/**
 * The system defaults for a new case's certificate print options, plus whether
 * they have loaded, so a new case is not seeded from the fallback values.
 */
export const useCertificatePrintDefaults = (): {
	defaults: CertificatePrintDefaults;
	isLoaded: boolean;
} => {
	const { data, isSuccess } = useFeatureFlags();
	return {
		defaults: {
			print_conveying_station:
				data?.default_print_conveying_station ??
				INITIAL_PRINT_DEFAULTS.print_conveying_station,
			print_requesting_station:
				data?.default_print_requesting_station ??
				INITIAL_PRINT_DEFAULTS.print_requesting_station,
			print_requesting_rank:
				data?.default_print_requesting_rank ??
				INITIAL_PRINT_DEFAULTS.print_requesting_rank,
		},
		isLoaded: isSuccess,
	};
};
