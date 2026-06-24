import { useQuery } from "@tanstack/react-query";
import { SystemSettingsService } from "@/shared/services";

export const useSystemSettings = () => {
	return useQuery({
		queryKey: ["system", "settings"],
		queryFn: () => SystemSettingsService.getSettings(),
		staleTime: 0, // Always refetch on mount to pick up changes from other pages
	});
};
