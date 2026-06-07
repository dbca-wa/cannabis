import { NavLink } from "react-router";
import { motion } from "motion/react";
import { Logo } from "@/shared/components/Logo";
import UserMenu from "./UserMenu";
import { SidebarNav } from "./SidebarNav";
import { SIDEBAR_BG_VARIANTS } from "@/shared/styles/sidebar-variants";

// Change this to "default" to revert to the clean white/dark sidebar
const SIDEBAR_VARIANT: keyof typeof SIDEBAR_BG_VARIANTS = "cannabis";

const Sidebar = () => {
	return (
		<aside
			className={`w-[260px] shrink-0 h-screen sticky top-0 border-r border-border ${SIDEBAR_BG_VARIANTS[SIDEBAR_VARIANT]} flex flex-col`}
		>
			<NavLink
				to="/"
				className="flex items-center gap-3 px-6 py-5 border-b border-border/60 group cursor-pointer"
			>
				<motion.div
					whileHover={{ rotate: -8, scale: 1.08 }}
					transition={{ type: "spring", stiffness: 260, damping: 18 }}
				>
					<Logo size={34} />
				</motion.div>
				<div className="flex flex-col leading-tight">
					<span className="text-[15px] font-medium tracking-tight">
						Cannabis
					</span>
					<span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
						DBCA Herbarium
					</span>
				</div>
			</NavLink>

			<SidebarNav pillId="sidebar-pill" />

			<div className="p-3 border-t border-border/60">
				<UserMenu />
			</div>
		</aside>
	);
};

export default Sidebar;
