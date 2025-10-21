import { useQuery } from "@tanstack/react-query";
import { usersService } from "../services/users.service";
import { usersQueryKeys } from "./useUsers";
import { APP_CONFIG } from "@/app/config/app.config";

export const useUserById = (id: number | null) => {
	return useQuery({
		queryKey: id ? usersQueryKeys.detail(id) : ["users", "detail", null],
		queryFn: async () => {
			if (!id) return null;

			const result = await usersService.getUserById(id);

			if (!result.success) {
				throw new Error(result.error || "Failed to fetch user");
			}

			return result.data; // return unwrapped data
		},
		enabled: !!id,
		staleTime: APP_CONFIG.CACHE.USER_DATA_TTL,
		gcTime: APP_CONFIG.CACHE.USER_DATA_TTL * 2,
	});
};
