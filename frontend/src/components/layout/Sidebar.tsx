import { useAuthStore } from "@/stores/rootStore";
import { PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { LogOut, User } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Button } from "../ui/button";
import { Popover } from "../ui/popover";
import CannabisLogo from "./CannabisLogo";
import SidebarButton from "./SidebarButton";
import { REGULAR_SIDEBAR_ITEMS } from "./utils";
import { cn } from "@/lib/utils";

const Sidebar = observer(() => {
	const authStore = useAuthStore();

	const handleLogout = () => {
		authStore.logout();
	};

	return (
		<aside
			className={cn(
				"w-20 bg-slate-200 text-white flex flex-col justify-between",
				"border-r border-slate-300 shadow-md"
			)}
		>
			<div>
				<div className="p-3 flex justify-center">
					<CannabisLogo shouldAnimate={false} size="sm" logoOnly />
					{/* <h2 className="text-2xl font-bold">Cannabis</h2> */}
				</div>
				<nav className="space-y-1">
					{REGULAR_SIDEBAR_ITEMS.map(
						(item) =>
							// Skip rendering admin-only items for non-admins
							(!item.adminOnly || authStore.isAdmin) && (
								<SidebarButton
									key={item.name}
									name={item.name}
									hideName={false}
									adminOnly={item.adminOnly}
									icon={item.icon}
									activeIcon={item.activeIcon}
									tooltipContent={
										item.tooltipContent || undefined
									}
								/>
							)
					)}
				</nav>
			</div>
			<div className="w-full flex items-center justify-center pb-4">
				<Popover>
					<PopoverTrigger asChild>
						<Button
							className="cursor:pointer cannabis-green"
							variant="sidebarButton"
							size="icon"
							asChild
						>
							<div className="text-sm">
								<User className="size-6" />
							</div>
						</Button>
					</PopoverTrigger>
					<PopoverContent
						side="right"
						sideOffset={30}
						className={cn(
							"mb-2 gap-2 rounded-lg w-[260px] p-4 flex flex-col justify-center items-center",
							"text-black popover-bg",
							"shadow-md shadow-green-700"
						)}
					>
						<p className="truncate">{authStore.user?.email}</p>
						<p className="truncate">{authStore.user?.role}</p>
						<Button
							variant="sidebarButton"
							size="icon"
							onClick={handleLogout}
							className="text-slate-500 hover:text-red-500 flex !w-fit"
						>
							<span>Logout</span>
							<LogOut size={18} />
						</Button>
					</PopoverContent>
				</Popover>
			</div>
		</aside>
	);
});

export default Sidebar;
