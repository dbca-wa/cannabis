import { Link, useLocation } from "react-router";
import { observer } from "mobx-react-lite";
import { useAuthStore, useUIStore } from "@/stores/rootStore";
import { Home, Users, FileText, Settings } from "lucide-react";
import { useEffect } from "react";

const Sidebar = observer(() => {
	const location = useLocation();
	const authStore = useAuthStore();
	const uiStore = useUIStore();
	const currentPath = location.pathname;

	// Define navigation items for reuse
	const navItems = [
		{
			path: "/",
			exact: true, // Only match exact path for home
			icon: <Home size={20} />,
			label: "Dashboard",
			section: "dashboard",
		},
		{
			path: "/users",
			icon: <Users size={20} />,
			label: "Users",
			section: "users",
		},
		{
			path: "/submissions",
			icon: <FileText size={20} />,
			label: "Submissions",
			section: "submissions",
		},
		{
			path: "/admin",
			icon: <Settings size={20} />,
			label: "Admin",
			section: "admin",
			adminOnly: true,
		},
	];

	// Update active section when location changes
	useEffect(() => {
		// Find the matching nav item
		const matchedItem = navItems.find((item) => {
			if (item.exact) {
				return currentPath === item.path;
			}
			return uiStore.isActiveOrChildPath(item.path, currentPath);
		});

		if (matchedItem) {
			uiStore.setActiveSection(matchedItem.section);

			// Also update page metadata based on section
			uiStore.setPageMetadata({
				title: matchedItem.label,
			});
		}
	}, [currentPath, uiStore]);

	return (
		<aside className="w-64 bg-slate-800 text-white">
			<div className="p-6">
				<h2 className="text-2xl font-bold">App Name</h2>
			</div>
			<nav className="space-y-1">
				{navItems.map(
					(item) =>
						// Skip rendering admin-only items for non-admins
						(!item.adminOnly || authStore.isAdmin) && (
							<SidebarLink
								key={item.path}
								to={item.path}
								icon={item.icon}
								label={item.label}
								active={
									item.exact
										? currentPath === item.path
										: uiStore.isActiveOrChildPath(
												item.path,
												currentPath
										  )
								}
							/>
						)
				)}
			</nav>
		</aside>
	);
});

type SidebarLinkProps = {
	to: string;
	icon: React.ReactNode;
	label: string;
	active: boolean;
};

const SidebarLink = ({ to, icon, label, active }: SidebarLinkProps) => {
	return (
		<Link
			to={to}
			className={`flex items-center px-6 py-3 transition-colors ${
				active
					? "bg-slate-700 text-white"
					: "text-slate-300 hover:bg-slate-700 hover:text-white"
			}`}
		>
			<span className="mr-3">{icon}</span>
			<span>{label}</span>
		</Link>
	);
};

export default Sidebar;
