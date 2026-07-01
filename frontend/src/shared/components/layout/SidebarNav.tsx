import { NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import {
	LayoutDashboard,
	FileStack,
	Users,
	Shield,
	Building2,
	UserSquare2,
	DollarSign,
	Settings,
	Boxes,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";

const SHOW_DEV_PAGES = import.meta.env.VITE_SHOW_DEV_PAGES === "true";

interface NavItem {
	to: string;
	label: string;
	icon: typeof LayoutDashboard;
	adminOnly?: boolean;
	devOnly?: boolean;
}

interface NavGroup {
	label?: string;
	items: NavItem[];
}

/** Shared navigation groups used by both desktop and mobile sidebars. */
// eslint-disable-next-line react-refresh/only-export-components
export const navGroups: NavGroup[] = [
	{
		label: "DBCA",
		items: [
			{ to: "/", label: "Dashboard", icon: LayoutDashboard },
			{ to: "/staff", label: "Staff", icon: Users },
			{
				to: "/admin",
				label: "Testing",
				icon: Settings,
				adminOnly: true,
				devOnly: true,
			},
		],
	},
	{
		label: "Casework",
		items: [
			{ to: "/cases", label: "Cases", icon: FileStack },
			{ to: "/batches", label: "Batches", icon: Boxes },
			{ to: "/financials", label: "Financials", icon: DollarSign },
		],
	},
	{
		label: "Police",
		items: [
			{ to: "/officers", label: "Officers", icon: Shield },
			{ to: "/stations", label: "Stations", icon: Building2 },
			{ to: "/defendants", label: "Defendants", icon: UserSquare2 },
		],
	},
];

interface SidebarNavProps {
	/** Unique layoutId prefix for the active pill animation (avoids conflicts between desktop/mobile). */
	pillId?: string;
	/** Called when a nav link is clicked (used by mobile sidebar to close the drawer). */
	onNavigate?: () => void;
}

/**
 * Shared sidebar navigation content — renders grouped nav links with active
 * pill animation. Used by both the desktop Sidebar and MobileSidebar.
 */
export const SidebarNav = ({
	pillId = "sidebar-pill",
	onNavigate,
}: SidebarNavProps) => {
	const location = useLocation();
	const { user, hasAppAccess } = useAuth();

	return (
		<nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
			{navGroups.map((group, groupIdx) => {
				const visibleItems = group.items.filter(
					(item) =>
						// Roleless, non-admin users only ever see the Dashboard
						(hasAppAccess || item.to === "/") &&
						(!item.adminOnly || user?.is_superuser) &&
						(!item.devOnly || SHOW_DEV_PAGES)
				);

				if (visibleItems.length === 0) return null;

				return (
					<div key={groupIdx} className="space-y-0.5">
						{group.label && (
							<span className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
								{group.label}
							</span>
						)}
						{visibleItems.map((item) => {
							const active =
								item.to === "/"
									? location.pathname === "/"
									: location.pathname.startsWith(item.to);
							// Only skip navigation if already on the exact same path
							const isExactMatch = location.pathname === item.to;
							const Icon = item.icon;

							return (
								<NavLink
									key={item.to}
									to={item.to}
									onClick={(e) => {
										// Skip navigation if already on the exact same route
										if (isExactMatch) {
											e.preventDefault();
											return;
										}
										onNavigate?.();
									}}
									className="relative block cursor-pointer"
								>
									<div
										className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
											active
												? "text-emerald-700 dark:text-emerald-300"
												: "text-muted-foreground hover:text-foreground hover:bg-accent"
										}`}
									>
										{active && (
											<motion.div
												layoutId={pillId}
												className="absolute inset-0 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg ring-1 ring-emerald-200/70 dark:ring-emerald-900"
												transition={{
													type: "spring",
													stiffness: 380,
													damping: 32,
												}}
											/>
										)}
										<Icon className="w-[18px] h-[18px] relative z-10" />
										<span className="relative z-10">{item.label}</span>
									</div>
								</NavLink>
							);
						})}
					</div>
				);
			})}
		</nav>
	);
};
