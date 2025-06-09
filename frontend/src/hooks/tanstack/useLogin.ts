import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authService } from "@/api/authService";
import { toast } from "sonner";

interface LoginCredentials {
	email: string;
	password: string;
}

export const useLogin = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation({
		mutationFn: async ({ email, password }: LoginCredentials) =>
			authService.login(email, password),
		onSuccess: () => {
			toast.success("Logged in successfully");

			// Invalidate the currentUser query to fetch fresh user data
			queryClient.invalidateQueries({ queryKey: ["currentUser"] });

			navigate("/");
		},
		onError: (error: Error) => {
			console.error("Login error:", error);

			toast.error(`Login failed: ${error}`);
		},
	});
};
