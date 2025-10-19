import { useQuery } from "@tanstack/react-query";
import { SystemSettingsService } from "@/shared/services";

export const useSystemSettings = () => {
	return useQuery({
		queryKey: ["system", "settings"],
		queryFn: () => SystemSettingsService.getSettings(),
		staleTime: 10 * 60 * 1000, // 10 minutes - settings don't change often
	});
};
