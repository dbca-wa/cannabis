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
 * The botanist to pre-select on a new case, or null when no default is set or
 * the configured user no longer holds the role.
 */
export const useDefaultBotanistId = (): number | null => {
	const { data } = useFeatureFlags();
	return data?.default_approved_botanist ?? null;
};
