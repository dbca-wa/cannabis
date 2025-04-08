// router.tsx with error handling
import { createBrowserRouter, redirect } from "react-router";

// Layouts
import AuthLayout from "@/components/layout/AuthLayout";
import MainLayout from "@/components/layout/MainLayout";

// Pages
import Login from "@/routes/auth/Login";
import Register from "@/routes/auth/Register";
import Home from "@/routes/dashboard/Home";
import Users from "@/routes/users/Users";
import UserDetail from "@/routes/users/UserDetail";
import Submissions from "@/routes/submissions/Submissions";
import SubmissionDetail from "@/routes/submissions/SubmissionDetail";
import AdminPage from "./routes/admin/AdminPage";

// Store utils
import { getAuthStore } from "./stores/storeUtils";

// Error component
import ErrorPage from "./components/ErrorPage";

// Guards
const authGuard = () => {
	try {
		const authStore = getAuthStore();
		if (!authStore.isAuthenticated) {
			return redirect("/auth/login");
		}
		return null;
	} catch (error) {
		console.error("Auth guard error:", error);
		// If there's an error, redirect to login as a fallback
		return redirect("/auth/login");
	}
};

const guestGuard = () => {
	try {
		const authStore = getAuthStore();
		if (authStore.isAuthenticated) {
			return redirect("/");
		}
		return null;
	} catch (error) {
		console.error("Guest guard error:", error);
		// If there's an error, let them continue to auth pages
		return null;
	}
};

const adminGuard = () => {
	try {
		const authStore = getAuthStore();
		// default auth guard
		if (!authStore.isAuthenticated) {
			return redirect("/auth/login");
		}
		// Prevent access for non-admins by redirecting to dashboard
		if (!authStore.isAdmin) {
			return redirect("/");
		}
		return null;
	} catch (error) {
		console.error("Admin guard error:", error);
		return redirect("/auth/login");
	}
};

export const router = createBrowserRouter([
	{
		path: "/",
		errorElement: <ErrorPage />,
		children: [
			// Auth routes (for non-authenticated users)
			{
				path: "auth",
				element: <AuthLayout />,
				loader: guestGuard,
				errorElement: <ErrorPage />,
				children: [
					{ path: "login", element: <Login /> },
					{ path: "register", element: <Register /> },
				],
			},

			// Protected routes (for authenticated users)
			{
				element: <MainLayout />,
				loader: authGuard,
				errorElement: <ErrorPage />,
				children: [
					{ index: true, element: <Home /> },
					{
						path: "users",
						children: [
							{ index: true, element: <Users /> },
							{ path: ":id", element: <UserDetail /> },
						],
					},
					{
						path: "submissions",
						children: [
							{ index: true, element: <Submissions /> },
							{ path: ":id", element: <SubmissionDetail /> },
						],
					},
					{
						path: "admin",
						element: <AdminPage />,
						loader: adminGuard,
					},
				],
			},
		],
	},
]);
