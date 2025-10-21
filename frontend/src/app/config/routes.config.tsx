import { Home, Settings, Users, Shield, User, FileText } from "lucide-react";
import { lazy, Suspense } from "react";
import { Navigate } from "react-router";

// Lazy load pages for better performance
const HomePage = lazy(() => import("@/pages/dashboard/Home"));
const SubmissionsPage = lazy(() => import("@/pages/submissions/Submissions"));
const SubmissionFormDemoPage = lazy(
	() => import("@/pages/submissions/SubmissionFormDemo")
);
const PhaseWorkflowDemoPage = lazy(() =>
	import("@/pages/submissions/PhaseWorkflowDemo").then((m) => ({
		default: m.PhaseWorkflowDemo,
	}))
);
const PhaseProgressDemoPage = lazy(
	() => import("@/pages/submissions/PhaseProgressDemo")
);
const SubmissionDetailPage = lazy(() =>
	import("@/pages/submissions/SubmissionDetailPage").then((m) => ({
		default: m.SubmissionDetailPage,
	}))
);
const UsersPage = lazy(() => import("@/pages/users/Users"));
const PolicePage = lazy(() => import("@/pages/police/Police"));
const DefendantsPage = lazy(() => import("@/pages/defendants/Defendants"));
const DocumentsPage = lazy(() => import("@/pages/documents/Documents"));
// const AdminPage = lazy(() => import("@/pages/admin/Admin")); // dummy page

// User modals
const AddUserModal = lazy(() =>
	import("@/features/user/components/modals/AddUserModal").then((m) => ({
		default: m.AddUserModal,
	}))
);
const EditUserModal = lazy(() =>
	import("@/features/user/components/modals/EditUserModal").then((m) => ({
		default: m.EditUserModal,
	}))
);
const DeleteUserModal = lazy(
	() => import("@/features/user/components/modals/DeleteUserModal")
);

// Police modals
const CreateOfficerRouteModal = lazy(() =>
	import(
		"@/features/police/components/officers/CreateOfficerRouteModal"
	).then((m) => ({
		default: m.CreateOfficerRouteModal,
	}))
);
const EditOfficerRouteModal = lazy(() =>
	import("@/features/police/components/officers/EditOfficerRouteModal").then(
		(m) => ({
			default: m.EditOfficerRouteModal,
		})
	)
);
const DeleteOfficerRouteModal = lazy(() =>
	import(
		"@/features/police/components/officers/DeleteOfficerRouteModal"
	).then((m) => ({
		default: m.DeleteOfficerRouteModal,
	}))
);
const CreateStationRouteModal = lazy(() =>
	import(
		"@/features/police/components/stations/CreateStationRouteModal"
	).then((m) => ({
		default: m.CreateStationRouteModal,
	}))
);
const EditStationRouteModal = lazy(() =>
	import("@/features/police/components/stations/EditStationRouteModal").then(
		(m) => ({
			default: m.EditStationRouteModal,
		})
	)
);
const DeleteStationRouteModal = lazy(() =>
	import(
		"@/features/police/components/stations/DeleteStationRouteModal"
	).then((m) => ({
		default: m.DeleteStationRouteModal,
	}))
);

// Defendants modals
const CreateDefendantRouteModal = lazy(() =>
	import("@/features/defendants/components/CreateDefendantRouteModal").then(
		(m) => ({
			default: m.CreateDefendantRouteModal,
		})
	)
);
const EditDefendantRouteModal = lazy(() =>
	import("@/features/defendants/components/EditDefendantRouteModal").then(
		(m) => ({
			default: m.EditDefendantRouteModal,
		})
	)
);
const DeleteDefendantRouteModal = lazy(() =>
	import("@/features/defendants/components/DeleteDefendantRouteModal").then(
		(m) => ({
			default: m.DeleteDefendantRouteModal,
		})
	)
);

// Submission pages
const CreateSubmission = lazy(() =>
	import("@/pages/submissions/CreateSubmission").then((m) => ({
		default: m.CreateSubmission,
	}))
);
const EditSubmission = lazy(() =>
	import("@/pages/submissions/EditSubmission").then((m) => ({
		default: m.EditSubmission,
	}))
);
const DeleteSubmissionRouteModal = lazy(() =>
	import(
		"@/features/submissions/components/modals/DeleteSubmissionRouteModal"
	).then((m) => ({
		default: m.DeleteSubmissionRouteModal,
	}))
);

// Certificate modals
const CreateCertificateRouteModal = lazy(() =>
	import(
		"@/features/certificates/components/CreateCertificateRouteModal"
	).then((m) => ({
		default: m.CreateCertificateRouteModal,
	}))
);
const EditCertificateRouteModal = lazy(() =>
	import("@/features/certificates/components/EditCertificateRouteModal").then(
		(m) => ({
			default: m.EditCertificateRouteModal,
		})
	)
);
const DeleteCertificateRouteModal = lazy(() =>
	import(
		"@/features/certificates/components/DeleteCertificateRouteModal"
	).then((m) => ({
		default: m.DeleteCertificateRouteModal,
	}))
);

// Invoice modals
const CreateInvoiceRouteModal = lazy(() =>
	import("@/features/invoices/components/CreateInvoiceRouteModal").then(
		(m) => ({
			default: m.CreateInvoiceRouteModal,
		})
	)
);
const EditInvoiceRouteModal = lazy(() =>
	import("@/features/invoices/components/EditInvoiceRouteModal").then(
		(m) => ({
			default: m.EditInvoiceRouteModal,
		})
	)
);
const DeleteInvoiceRouteModal = lazy(() =>
	import("@/features/invoices/components/DeleteInvoiceRouteModal").then(
		(m) => ({
			default: m.DeleteInvoiceRouteModal,
		})
	)
);

export interface RouteConfig {
	// Sidebar configuration
	name: string;
	path: string;
	icon: React.ReactNode;
	activeIcon: React.ReactNode;
	tooltipContent: React.ReactNode;
	adminOnly: boolean;
	showInSidebar: boolean;

	// Router configuration
	element: React.ComponentType;
	children?: {
		path: string;
		element: React.ComponentType;
	}[];

	// Optional: for routes that need default redirects (Police, Docs)
	defaultRedirect?: string;

	// Optional: simple CRUD pattern helper
	crudRoutes?: {
		entityParam: string; // e.g., "userId", "officerId"
		components: {
			add: React.ComponentType;
			edit: React.ComponentType;
			delete: React.ComponentType;
		};
	};
}

/**
 * Single source of truth for all routes
 * Add a new route here and it automatically appears in sidebar and router
 */
export const ROUTES_CONFIG: RouteConfig[] = [
	{
		name: "Home",
		path: "/",
		icon: <Home size={20} />,
		activeIcon: <Home size={20} />,
		tooltipContent: <p>View your dashboard</p>,
		adminOnly: false,
		showInSidebar: true,
		element: HomePage,
	},
	{
		name: "Submissions",
		path: "/submissions",
		icon: <FileText size={20} />,
		activeIcon: <FileText size={20} />,
		tooltipContent: (
			<p>Manage cannabis sample submissions and assessments</p>
		),
		adminOnly: false,
		showInSidebar: true,
		element: SubmissionsPage,
		children: [
			// CRUD routes
			{ path: "add", element: CreateSubmission },
			{ path: ":submissionId", element: EditSubmission },
			{
				path: ":submissionId/delete",
				element: DeleteSubmissionRouteModal,
			},
			// Custom routes
			{ path: "demo", element: SubmissionFormDemoPage },
			{ path: "workflow-demo", element: PhaseWorkflowDemoPage },
			{ path: "phase-progress-demo", element: PhaseProgressDemoPage },
			{
				path: ":submissionId/detail",
				element: SubmissionDetailPage,
			},
		],
	},
	{
		name: "Users",
		path: "/users",
		icon: <Users size={20} />,
		activeIcon: <Users size={20} />,
		tooltipContent: <p>View, edit, or create users</p>,
		adminOnly: false,
		showInSidebar: true,
		element: UsersPage,
		crudRoutes: {
			entityParam: "userId",
			components: {
				add: AddUserModal,
				edit: EditUserModal,
				delete: DeleteUserModal,
			},
		},
	},
	{
		name: "Police",
		path: "/police",
		icon: <Shield size={20} />,
		activeIcon: <Shield size={20} />,
		tooltipContent: <p>Manage police officers and stations</p>,
		adminOnly: false,
		showInSidebar: true,
		element: PolicePage,
		defaultRedirect: "/police/officers",
		crudRoutes: {
			entityParam: "officerId",
			components: {
				add: CreateOfficerRouteModal,
				edit: EditOfficerRouteModal,
				delete: DeleteOfficerRouteModal,
			},
		},
		children: [
			// Tab routes
			{ path: "officers", element: PolicePage },
			{ path: "stations", element: PolicePage },
			// Station routes (different entity, so manual)
			{ path: "stations/add", element: CreateStationRouteModal },
			{ path: "stations/:stationId", element: EditStationRouteModal },
			{
				path: "stations/:stationId/delete",
				element: DeleteStationRouteModal,
			},
		],
	},
	{
		name: "Defendants",
		path: "/defendants",
		icon: <User size={20} />,
		activeIcon: <User size={20} />,
		tooltipContent: <p>Manage defendants and case associations</p>,
		adminOnly: false,
		showInSidebar: true,
		element: DefendantsPage,
		crudRoutes: {
			entityParam: "defendantId",
			components: {
				add: CreateDefendantRouteModal,
				edit: EditDefendantRouteModal,
				delete: DeleteDefendantRouteModal,
			},
		},
	},
	{
		name: "Docs",
		path: "/docs",
		icon: <FileText size={20} />,
		activeIcon: <FileText size={20} />,
		tooltipContent: <p>Manage certificates and invoices</p>,
		adminOnly: false,
		showInSidebar: true,
		element: DocumentsPage,
		defaultRedirect: "/docs/certificates",
		children: [
			// Tab routes
			{ path: "certificates", element: DocumentsPage },
			{ path: "invoices", element: DocumentsPage },
			// Certificate routes (different entities, so manual)
			{ path: "certificates/add", element: CreateCertificateRouteModal },
			{
				path: "certificates/:certificateId",
				element: EditCertificateRouteModal,
			},
			{
				path: "certificates/:certificateId/delete",
				element: DeleteCertificateRouteModal,
			},
			// Invoice routes (different entities, so manual)
			{ path: "invoices/add", element: CreateInvoiceRouteModal },
			{ path: "invoices/:invoiceId", element: EditInvoiceRouteModal },
			{
				path: "invoices/:invoiceId/delete",
				element: DeleteInvoiceRouteModal,
			},
		],
	},
	// Dummy admin route. TODO
	// {
	// 	name: "Admin",
	// 	path: "/admin",
	// 	icon: <Settings size={20} />,
	// 	activeIcon: <Settings size={20} />,
	// 	tooltipContent: <p>System administration and management tools</p>,
	// 	adminOnly: true, // Only visible to admin users
	// 	showInSidebar: true,
	// 	element: AdminPage,
	// },
];

// Loading fallback component
const PageLoader = () => (
	<div className="flex items-center justify-center min-h-[200px]">
		<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
	</div>
);

// Simple helper to generate CRUD routes - no complex factory needed
const generateCrudRoutes = (
	crudConfig: NonNullable<RouteConfig["crudRoutes"]>
) => {
	const { entityParam, components } = crudConfig;
	return [
		{ path: "add", element: components.add },
		{ path: `:${entityParam}`, element: components.edit },
		{ path: `:${entityParam}/delete`, element: components.delete },
	];
};

// Simple helper to generate route children
export const generateRouteChildren = () => {
	return ROUTES_CONFIG.map((route) => {
		const Element = route.element;

		if (route.path === "/") {
			return {
				index: true,
				element: (
					<Suspense fallback={<PageLoader />}>
						<Element />
					</Suspense>
				),
			};
		}

		const children: any[] = [];

		// Handle default redirects (Police, Docs)
		if (route.defaultRedirect) {
			children.push({
				index: true,
				element: <Navigate to={route.defaultRedirect} replace />,
			});
		} else {
			children.push({
				index: true,
				element: (
					<Suspense fallback={<PageLoader />}>
						<Element />
					</Suspense>
				),
			});
		}

		// Add manual child routes
		if (route.children) {
			children.push(
				...route.children.map((child) => {
					const ChildElement = child.element;
					return {
						path: child.path,
						element: (
							<Suspense fallback={<PageLoader />}>
								<ChildElement />
							</Suspense>
						),
					};
				})
			);
		}

		// Add CRUD routes if configured
		if (route.crudRoutes) {
			children.push(
				...generateCrudRoutes(route.crudRoutes).map((crudRoute) => {
					const CrudElement = crudRoute.element;
					return {
						path: crudRoute.path,
						element: (
							<Suspense fallback={<PageLoader />}>
								<CrudElement />
							</Suspense>
						),
					};
				})
			);
		}

		return {
			path: route.path.slice(1),
			children,
		};
	});
};

// Helper functions for backward compatibility
export const getSidebarItems = () =>
	ROUTES_CONFIG.filter((route) => route.showInSidebar);

export const getRouteFromSidebarItem = (sidebarItem: string): string => {
	const route = ROUTES_CONFIG.find((r) => r.name === sidebarItem);

	// Special handling for Police - navigate to officers tab by default
	if (route?.name === "Police") {
		return "/police/officers";
	}

	// Special handling for Docs - navigate to certificates tab by default
	if (route?.name === "Docs") {
		return "/docs/certificates";
	}

	return route?.path || "/";
};

export const getSidebarItemFromRoute = (pathname: string): string => {
	// Check for exact matches first
	const exactMatch = ROUTES_CONFIG.find((r) => r.path === pathname);
	if (exactMatch) return exactMatch.name;

	// Special handling for police routes - both /police/officers and /police/stations should highlight "Police"
	if (pathname.startsWith("/police")) {
		return "Police";
	}

	// Special handling for docs routes - both /docs/certificates and /docs/invoices should highlight "Docs"
	if (pathname.startsWith("/docs")) {
		return "Docs";
	}

	// Handle nested routes by finding the closest parent route
	const matchingRoute = ROUTES_CONFIG.filter((r) => r.path !== "/") // Skip root route for nested route checking
		.find((r) => pathname.startsWith(r.path));

	return matchingRoute?.name || "Home";
};
