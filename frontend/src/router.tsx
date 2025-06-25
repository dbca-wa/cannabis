// router.tsx with error handling
import { createBrowserRouter, redirect } from "react-router";

// Layouts
import AuthLayout from "@/components/layout/AuthLayout";
import MainLayout from "@/components/layout/MainLayout";
import { rootStore } from "@/stores/rootStore"; // Use rootStore instead

// Pages
import Login from "@/routes/auth/Login";
import Home from "@/routes/dashboard/Home";
import Users from "@/routes/users/Users";
import Submissions from "@/routes/submissions/Submissions";
import AdminPage from "./routes/admin/AdminPage";
import ErrorPage from "./components/ErrorPage";
import Organisations from "./routes/organisations/Organisations";
import { EditUserModal } from "./routes/users/EditUserModal";
import { AddUserModal } from "./routes/users/AddUserModal";
import Certificates from "./routes/certificates/Certificates";
import DeleteUserModal from "./routes/users/DeleteUserModal";
import DeleteOrganisationModal from "./routes/organisations/DeleteOraganisationModal";
import { AddOrganisationModal } from "./routes/organisations/AddOrganisationModal";
import { EditOrganisationModal } from "./routes/organisations/EditOrganisationModal";
import { EditSubmissionModal } from "./routes/submissions/EditSubmissionModal";
import { AddSubmissionModal } from "./routes/submissions/AddSubmissionModal";
import { DeleteSubmissionModal } from "./routes/submissions/DeleteSubmissionModal";
import { AddCertificateModal } from "./routes/certificates/AddCertificateModal";
import { EditCertificateModal } from "./routes/certificates/EditCertificateModal";
import { DeleteCertificateModal } from "./routes/certificates/DeleteCertificateModal";

// Get authStore from rootStore
const authStore = rootStore.authStore;

// Auth guards using session-based authentication
const authGuard = async () => {
	try {
		console.log("AuthGuard: Starting, isLoading:", authStore.isLoading);

		// Wait for the auth store to finish its initial check
		while (authStore.isLoading) {
			console.log("AuthGuard: Waiting for auth check to complete...");
			// Simple delay - auth check completes very quickly
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		console.log("AuthGuard: Auth check completed");
		console.log(
			"AuthGuard: Final auth state - isAuthenticated:",
			authStore.isAuthenticated
		);

		if (!authStore.isAuthenticated) {
			console.log(
				"AuthGuard: User not authenticated, redirecting to login"
			);
			return redirect("/auth/login");
		}

		console.log("AuthGuard: User authenticated, allowing access");
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
			// Wait for auth check if still loading
			if (authStore.isLoading) {
				await new Promise<void>((resolve) => {
					const checkInterval = setInterval(() => {
						if (!authStore.isLoading) {
							clearInterval(checkInterval);
							resolve();
						}
					}, 50);

					setTimeout(() => {
						clearInterval(checkInterval);
						resolve();
					}, 5000);
				});
			}

			if (authStore.isAuthenticated) {
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
		// Wait for auth check if still loading
		if (authStore.isLoading) {
			await new Promise<void>((resolve) => {
				const checkInterval = setInterval(() => {
					if (!authStore.isLoading) {
						clearInterval(checkInterval);
						resolve();
					}
				}, 50);

				setTimeout(() => {
					clearInterval(checkInterval);
					resolve();
				}, 5000);
			});
		}

		if (!authStore.isAuthenticated) {
			return redirect("/auth/login");
		}

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
						children: [
							{ index: true, element: <Users /> },
							{
								path: ":userId",
								element: <EditUserModal />,
							},
							{
								path: "add",
								element: <AddUserModal />,
							},
							{
								path: ":userId/delete",
								element: <DeleteUserModal />,
							},
						],
					},
					{
						path: "organisations",
						children: [
							{ index: true, element: <Organisations /> },
							{
								path: ":organisationId",
								element: <EditOrganisationModal />,
							},
							{
								path: "add",
								element: <AddOrganisationModal />,
							},
							{
								path: ":organisationId/delete",
								element: <DeleteOrganisationModal />,
							},
						],
					},
					{
						path: "submissions",
						children: [
							{ index: true, element: <Submissions /> },
							{
								path: ":submissionId",
								element: <EditSubmissionModal />,
							},
							{
								path: "add",
								element: <AddSubmissionModal />,
							},
							{
								path: "submissionId/delete",
								element: <DeleteSubmissionModal />,
							},
						],
					},
					{
						path: "certificates",
						children: [
							{ index: true, element: <Certificates /> },
							{
								path: ":certificateId",
								element: <EditCertificateModal />,
							},
							{
								path: "add",
								element: <AddCertificateModal />,
							},
							{
								path: "certificateId/delete",
								element: <DeleteCertificateModal />,
							},
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
