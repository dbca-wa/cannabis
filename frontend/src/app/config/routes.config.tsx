/* eslint-disable react-refresh/only-export-components */
import {
	Home,
	Settings,
	Users,
	Shield,
	User,
	TestTube,
	PenLine,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { FaTriangleExclamation } from "react-icons/fa6";
import { Navigate, type RouteObject } from "react-router";

const SHOW_DEV_PAGES = import.meta.env.VITE_SHOW_DEV_PAGES === "true";

// Lazy load pages for better performance
const HomePage = lazy(() => import("@/pages/dashboard/Home"));
const TestsHomePage = lazy(() => import("@/pages/tests/TestsHomePage"));
const TestEmailPage = lazy(() => import("@/pages/tests/TestEmailPage"));
const TestCertificatePage = lazy(
	() => import("@/pages/tests/TestCertificatePage")
);
const TestInvoicePage = lazy(() => import("@/pages/tests/TestInvoicePage"));
const CasesPage = lazy(() => import("@/pages/cases/Cases"));
const StaffPage = lazy(() => import("@/pages/users/Staff"));
const OfficersPage = lazy(() => import("@/pages/police/Officers"));
const StationsPage = lazy(() => import("@/pages/police/Stations"));
const DefendantsPage = lazy(() => import("@/pages/defendants/Defendants"));
const AdminPage = lazy(() => import("@/pages/admin/Admin"));
const FinancialsPage = lazy(() => import("@/pages/financials/Financials"));
const SignaturePage = lazy(() => import("@/pages/signature/SignaturePage"));
const ChangePasswordPage = lazy(() => import("@/pages/auth/ChangePassword"));
const DefendantMergePage = lazy(() =>
	import("@/features/defendants/components/merge/DefendantMergePage").then(
		(m) => ({ default: m.DefendantMergePage })
	)
);
const StationMergePage = lazy(() =>
	import("@/features/police/components/stations/merge/StationMergePage").then(
		(m) => ({ default: m.StationMergePage })
	)
);
const OfficerMergePage = lazy(() =>
	import("@/features/police/components/officers/merge/OfficerMergePage").then(
		(m) => ({ default: m.OfficerMergePage })
	)
);

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
	import("@/features/police/components/officers/CreateOfficerRouteModal").then(
		(m) => ({
			default: m.CreateOfficerRouteModal,
		})
	)
);
const EditOfficerRouteModal = lazy(() =>
	import("@/features/police/components/officers/EditOfficerRouteModal").then(
		(m) => ({
			default: m.EditOfficerRouteModal,
		})
	)
);
const DeleteOfficerRouteModal = lazy(() =>
	import("@/features/police/components/officers/DeleteOfficerRouteModal").then(
		(m) => ({
			default: m.DeleteOfficerRouteModal,
		})
	)
);
const CreateStationRouteModal = lazy(() =>
	import("@/features/police/components/stations/CreateStationRouteModal").then(
		(m) => ({
			default: m.CreateStationRouteModal,
		})
	)
);
const EditStationRouteModal = lazy(() =>
	import("@/features/police/components/stations/EditStationRouteModal").then(
		(m) => ({
			default: m.EditStationRouteModal,
		})
	)
);
const DeleteStationRouteModal = lazy(() =>
	import("@/features/police/components/stations/DeleteStationRouteModal").then(
		(m) => ({
			default: m.DeleteStationRouteModal,
		})
	)
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

// Case pages
const CreateCase = lazy(() =>
	import("@/pages/cases/CreateCase").then((m) => ({
		default: m.CreateCase,
	}))
);
const ProcessCase = lazy(() =>
	import("@/pages/cases/ProcessCase").then((m) => ({
		default: m.ProcessCase,
	}))
);
const EditCase = lazy(() =>
	import("@/pages/cases/EditCase").then((m) => ({
		default: m.EditCase,
	}))
);
const DeleteCaseRouteModal = lazy(() =>
	import("@/features/cases/components/modals/DeleteCaseRouteModal").then(
		(m) => ({
			default: m.DeleteCaseRouteModal,
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

	// Optional: use element as layout (always rendered, children render in Outlet)
	useAsLayout?: boolean;

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
	...(SHOW_DEV_PAGES
		? [
				{
					name: "Test",
					path: "/tests",
					icon: <FaTriangleExclamation size={20} />,
					activeIcon: <FaTriangleExclamation size={20} />,
					tooltipContent: <p>Tests</p>,
					adminOnly: false,
					showInSidebar: true,
					element: TestsHomePage,
					children: [
						{ path: "emails", element: TestEmailPage },
						{ path: "certificates", element: TestCertificatePage },
						{ path: "invoices", element: TestInvoicePage },
					],
				} satisfies RouteConfig,
			]
		: []),
	{
		name: "Cases",
		path: "/cases",
		icon: <TestTube size={20} />,
		activeIcon: <TestTube size={20} />,
		tooltipContent: <p>Manage cannabis sample cases and assessments</p>,
		adminOnly: false,
		showInSidebar: true,
		element: CasesPage,
		useAsLayout: true,
		children: [
			// Modal routes (render in Outlet as overlays on top of CasesPage)
			{ path: "add", element: CreateCase },
			{ path: ":submissionId", element: EditCase },
			{
				path: ":submissionId/delete",
				element: DeleteCaseRouteModal,
			},
			// Full-page child routes
			{
				path: ":id/process",
				element: ProcessCase,
			},
		],
	},
	{
		name: "Staff",
		path: "/staff",
		icon: <Users size={20} />,
		activeIcon: <Users size={20} />,
		tooltipContent: <p>View, edit, or create users</p>,
		adminOnly: false,
		showInSidebar: true,
		element: StaffPage,
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
		name: "Officers",
		path: "/officers",
		icon: <Shield size={20} />,
		activeIcon: <Shield size={20} />,
		tooltipContent: <p>Manage police officers</p>,
		adminOnly: false,
		showInSidebar: true,
		element: OfficersPage,
		useAsLayout: true,
		children: [{ path: "merge", element: OfficerMergePage }],
		crudRoutes: {
			entityParam: "officerId",
			components: {
				add: CreateOfficerRouteModal,
				edit: EditOfficerRouteModal,
				delete: DeleteOfficerRouteModal,
			},
		},
	},
	{
		name: "Stations",
		path: "/stations",
		icon: <Shield size={20} />,
		activeIcon: <Shield size={20} />,
		tooltipContent: <p>Manage police stations</p>,
		adminOnly: false,
		showInSidebar: true,
		element: StationsPage,
		useAsLayout: true,
		children: [{ path: "merge", element: StationMergePage }],
		crudRoutes: {
			entityParam: "stationId",
			components: {
				add: CreateStationRouteModal,
				edit: EditStationRouteModal,
				delete: DeleteStationRouteModal,
			},
		},
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
		useAsLayout: true,
		children: [{ path: "merge", element: DefendantMergePage }],
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
		name: "Financials",
		path: "/financials",
		icon: <Home size={20} />,
		activeIcon: <Home size={20} />,
		tooltipContent: <p>Manage cost settings and pricing</p>,
		adminOnly: false,
		showInSidebar: true,
		element: FinancialsPage,
	},
	{
		name: "My Signature",
		path: "/signature",
		icon: <PenLine size={20} />,
		activeIcon: <PenLine size={20} />,
		tooltipContent: <p>Manage your digital signature</p>,
		adminOnly: false,
		showInSidebar: false,
		element: SignaturePage,
	},
	{
		name: "Change Password",
		path: "/change-password",
		icon: <Settings size={20} />,
		activeIcon: <Settings size={20} />,
		tooltipContent: <p>Update your account password</p>,
		adminOnly: false,
		showInSidebar: false,
		element: ChangePasswordPage,
	},
	{
		name: "Testing",
		path: "/admin",
		icon: <Settings size={20} />,
		activeIcon: <Settings size={20} />,
		tooltipContent: <p>Generate test documents and emails</p>,
		adminOnly: true,
		showInSidebar: true,
		element: AdminPage,
	},
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

		const children: RouteObject[] = [];

		// Handle default redirects (Police, Docs)
		if (route.defaultRedirect) {
			children.push({
				index: true,
				element: <Navigate to={route.defaultRedirect} replace />,
			});
		} else if (!route.useAsLayout) {
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
			...(route.useAsLayout
				? {
						element: (
							<Suspense fallback={<PageLoader />}>
								<Element />
							</Suspense>
						),
					}
				: {}),
			children,
		};
	});
};

// Helper functions for backward compatibility
export const getSidebarItems = () =>
	ROUTES_CONFIG.filter((route) => route.showInSidebar);

export const getRouteFromSidebarItem = (sidebarItem: string): string => {
	const route = ROUTES_CONFIG.find((r) => r.name === sidebarItem);
	return route?.path || "/";
};

export const getSidebarItemFromRoute = (pathname: string): string => {
	// Check for exact matches first
	const exactMatch = ROUTES_CONFIG.find((r) => r.path === pathname);
	if (exactMatch) return exactMatch.name;

	// Handle nested routes by prefix matching
	if (pathname.startsWith("/officers")) return "Officers";
	if (pathname.startsWith("/stations")) return "Stations";
	if (pathname.startsWith("/financials")) return "Financials";
	if (pathname.startsWith("/cases")) return "Cases";
	if (pathname.startsWith("/staff")) return "Staff";
	if (pathname.startsWith("/admin")) return "Testing";
	if (pathname.startsWith("/defendants")) return "Defendants";
	if (pathname.startsWith("/signature")) return "My Signature";
	if (pathname.startsWith("/change-password")) return "Change Password";

	return "Home";
};
