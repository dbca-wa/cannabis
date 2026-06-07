import { useQuery } from "@tanstack/react-query";
import { getUserById } from "../services/users.service";
import { usersQueryKeys } from "./useUsers";
import { APP_CONFIG } from "@/app/config/app.config";

export const useUserById = (id: number | null) => {
	return useQuery({
		queryKey: id ? usersQueryKeys.detail(id) : ["users", "detail", null],
		queryFn: async () => {
			if (!id) return null;
			return getUserById(id);
		},
		enabled: !!id,
		staleTime: APP_CONFIG.CACHE.USER_DATA_TTL,
		gcTime: APP_CONFIG.CACHE.USER_DATA_TTL * 2,
	});
};
