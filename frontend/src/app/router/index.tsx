import { createBrowserRouter } from "react-router";
import { rootAuthGuard } from "@/app/router/guards/auth.guard";
import { generateRouteChildren } from "@/app/config/routes.config";

// Layouts
import AuthLayout from "@/shared/components/layout/AuthLayout";
import MainLayout from "@/shared/components/layout/MainLayout";
import ErrorPage from "@/shared/components/layout/ErrorPage";

// Auth pages (not lazy loaded since they're critical)
import Login from "@/pages/auth/Login";
import PasswordUpdate from "@/pages/auth/PasswordUpdate";
import PasswordResetCodeEntry from "@/pages/auth/PasswordResetCodeEntry";
import PasswordResetSuccess from "@/pages/auth/PasswordResetSuccess";
import InviteActivation from "@/pages/auth/InviteActivation";
import InviteActivationError from "@/pages/auth/InviteActivationError";

export const router = createBrowserRouter([
	{
		path: "/",
		loader: rootAuthGuard,
		errorElement: <ErrorPage />,
		children: [
			{
				path: "auth",
				element: <AuthLayout />,
				children: [
					{ path: "login", element: <Login /> },
					{ path: "password-update", element: <PasswordUpdate /> },
					{ path: "reset-code", element: <PasswordResetCodeEntry /> },
					{ path: "reset-success", element: <PasswordResetSuccess /> },
					{ path: "activate-invite/:token", element: <InviteActivation /> },
					{ path: "invite-error", element: <InviteActivationError /> },
				],
			},
			{
				element: <MainLayout />,
				children: generateRouteChildren(),
			},
		],
	},
]);
