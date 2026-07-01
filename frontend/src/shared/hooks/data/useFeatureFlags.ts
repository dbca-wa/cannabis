import { useQuery } from "@tanstack/react-query";
import { SystemSettingsService } from "@/shared/services";

/**
 * Reads lightweight feature flags (e.g. OCR enablement). Unlike full system
 * settings (admin-only), these are readable by any app user, so the case
 * creation/processing flows can gate OCR UI on them.
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
