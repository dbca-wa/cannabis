// router.tsx with error handling
import { createBrowserRouter, redirect } from "react-router";
import { authService } from "@/api/authService";

// Layouts
import AuthLayout from "@/components/layout/AuthLayout";
import MainLayout from "@/components/layout/MainLayout";

// Pages
import Login from "@/routes/auth/Login";
import Home from "@/routes/dashboard/Home";
import Users from "@/routes/users/Users";
import Submissions from "@/routes/submissions/Submissions";
import AdminPage from "./routes/admin/AdminPage";
import ErrorPage from "./components/ErrorPage";
import Organisations from "./routes/organisations/Organisations";

// Auth guards using session-based authentication
const authGuard = async () => {
	try {
		const isAuthenticated = await authService.checkAuthStatus();
		if (!isAuthenticated) {
			return redirect("/auth/login");
		}
		return null;
	} catch (error) {
		console.error("Auth guard error:", error);
		return redirect("/auth/login");
	}
};

const guestGuard = async () => {
	try {
		// In production, DBCA middleware handles auth automatically
		if (process.env.NODE_ENV !== "development") {
			const isAuthenticated = await authService.checkAuthStatus();
			if (isAuthenticated) {
				return redirect("/");
			}
		}
		return null;
	} catch {
		return null;
	}
};

const adminGuard = async () => {
	try {
		const user = await authService.getCurrentUser();
		if (!user) {
			return redirect("/auth/login");
		}
		// Check if user is admin/superuser
		if (!user.is_superuser && !user.is_staff) {
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
			// Auth routes - only show in development
			...(process.env.NODE_ENV === "development"
				? [
						{
							path: "auth",
							element: <AuthLayout />,
							loader: guestGuard,
							errorElement: <ErrorPage />,
							children: [{ path: "login", element: <Login /> }],
						},
				  ]
				: []),

			// Protected routes (for authenticated users)
			{
				element: <MainLayout />,
				loader: authGuard,
				errorElement: <ErrorPage />,
				children: [
					{ index: true, element: <Home /> },
					{
						path: "users",
						children: [{ index: true, element: <Users /> }],
					},
					{
						path: "organisations",
						children: [{ index: true, element: <Organisations /> }],
					},
					{
						path: "submissions",
						children: [{ index: true, element: <Submissions /> }],
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
