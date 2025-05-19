import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { authApi } from "@/api/authApi";
import { runInAction } from "mobx";
import { getAuthStore } from "@/stores/storeUtils";

interface LoginCredentials {
	email: string;
	password: string;
}

export const useLogin = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const authStore = getAuthStore();

	const mutation = useMutation({
		mutationFn: async (credentials: LoginCredentials) => {
			console.log("Sending credentials", credentials);
			const response = await authApi.login(credentials);
			return response.data;
		},
		onSuccess: (data) => {
			// Update the store through proper MobX actions
			runInAction(() => {
				authStore.token = data.token;
				authStore.user = data.user;
			});

			// Also store token in localStorage
			localStorage.setItem("token", data.token);

			toast.success("Logged in successfully");

			// Invalidate the currentUser query to fetch fresh user data
			queryClient.invalidateQueries({ queryKey: ["currentUser"] });

			// Navigate to home page or dashboard
			navigate("/");
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onError: (error: any) => {
			const errorMessage =
				error.response?.data?.message ||
				error.message ||
				"Failed to login";

			toast.error(`Login failed: ${errorMessage}`);
		},
	});

	return mutation;
};
