import { createBrowserRouter } from "react-router";
import { rootAuthGuard } from "@/app/router/guards/auth.guard";
import { generateRouteChildren } from "@/app/config/routes.config";

// Layouts
import AuthLayout from "@/shared/components/layout/AuthLayout";
import MainLayout from "@/shared/components/layout/MainLayout";
import ErrorPage from "@/shared/components/layout/ErrorPage";

// Auth pages (not lazy loaded since they're critical)
import Login from "@/pages/auth/Login";

export const router = createBrowserRouter([
	{
		path: "/",
		loader: rootAuthGuard,
		errorElement: <ErrorPage />,
		children: [
			{
				path: "auth",
				element: <AuthLayout />,
				children: [{ path: "login", element: <Login /> }],
			},
			{
				element: <MainLayout />,
				children: generateRouteChildren(),
			},
		],
	},
]);
