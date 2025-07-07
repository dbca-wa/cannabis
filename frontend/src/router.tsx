// router.tsx with unified auth guard
import { createBrowserRouter } from "react-router";
import { rootAuthGuard, adminGuard } from "./guards/authGuards";

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

export const router = createBrowserRouter([
	{
		path: "/",
		loader: rootAuthGuard, // Apply unified guard to all routes
		errorElement: <ErrorPage />,
		children: [
			// Auth routes - only show in development
			...(process.env.NODE_ENV === "development"
				? [
						{
							path: "auth",
							element: <AuthLayout />,
							children: [{ path: "login", element: <Login /> }],
						},
				  ]
				: []),

			// Protected routes (for authenticated users)
			{
				element: <MainLayout />,
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
						loader: adminGuard, // Additional admin check
					},
				],
			},
		],
	},
]);
