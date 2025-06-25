import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/rootStore"; // Use the hook instead
import { toast } from "sonner";

interface LoginCredentials {
	email: string;
	password: string;
}

export const useLogin = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const authStore = useAuthStore(); // Get from context

	return useMutation({
		mutationFn: async ({ email, password }: LoginCredentials) => {
			// Use the authStore from context
			return authStore.login(email, password);
		},
		onSuccess: () => {
			toast.success("Logged in successfully");
			// Invalidate the currentUser query to fetch fresh user data
			queryClient.invalidateQueries({ queryKey: ["currentUser"] });
			navigate("/");
		},
		onError: (error: Error) => {
			console.error("Login error:", error);
			toast.error(`Login failed: ${error.message}`);
		},
	});
};
