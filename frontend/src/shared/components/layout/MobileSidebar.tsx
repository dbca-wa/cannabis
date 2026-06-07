import { observer } from "mobx-react-lite";
import { NavLink } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { Logo } from "@/shared/components/Logo";
import UserMenu from "./UserMenu";
import { SidebarNav } from "./SidebarNav";
import { SIDEBAR_BG_VARIANTS } from "@/shared/styles/sidebar-variants";

// Change this to "default" to revert to the clean white/dark sidebar
const SIDEBAR_VARIANT: keyof typeof SIDEBAR_BG_VARIANTS = "cannabis";

interface MobileSidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

const MobileSidebar = observer(({ isOpen, onClose }: MobileSidebarProps) => {
	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Overlay */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-black/50 z-[998] lg:hidden"
						onClick={onClose}
						aria-hidden="true"
					/>

					{/* Sidebar panel */}
					<motion.aside
						initial={{ x: "-100%" }}
						animate={{ x: 0 }}
						exit={{ x: "-100%" }}
						transition={{ type: "spring", stiffness: 380, damping: 34 }}
						className={`fixed left-0 top-0 h-full w-[260px] z-[999] lg:hidden flex flex-col border-r border-border ${SIDEBAR_BG_VARIANTS[SIDEBAR_VARIANT]} shadow-lg`}
					>
						{/* Header with close button */}
						<div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
							<NavLink
								to="/"
								onClick={onClose}
								className="flex items-center gap-3 group cursor-pointer"
							>
								<div className="shrink-0">
									<Logo size={34} />
								</div>
								<div className="flex flex-col leading-tight">
									<span className="text-[15px] font-medium tracking-tight">
										Cannabis
									</span>
									<span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
										DBCA Herbarium
									</span>
								</div>
							</NavLink>
							<button
								onClick={onClose}
								className="p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
								aria-label="Close menu"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* Shared navigation content */}
						<SidebarNav pillId="mobile-sidebar-pill" onNavigate={onClose} />

						{/* User menu */}
						<div className="p-3 border-t border-border/60">
							<UserMenu />
						</div>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	);
});

export default MobileSidebar;
