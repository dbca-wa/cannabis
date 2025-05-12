import { useAuthStore } from "@/stores/rootStore";
import { PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { LogOut, User } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Button } from "../ui/button";
import { Popover } from "../ui/popover";
import CannabisLogo from "./CannabisLogo";
import SidebarButton from "./SidebarButton";
import { REGULAR_SIDEBAR_ITEMS } from "./utils";

const Sidebar = observer(() => {
	const authStore = useAuthStore();

	const handleLogout = () => {
		authStore.logout();
	};

	return (
		<aside className="w-20 bg-slate-200 text-white flex flex-col justify-between">
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
						className="mb-2 gap-2 text-black bg-green-200 rounded-lg w-[260px] p-4 flex flex-col justify-center items-center"
					>
						<p className="truncate">{authStore.user?.email}</p>
						<Button
							variant="sidebarButton"
							size="icon"
							onClick={handleLogout}
							className="text-slate-500 hover:text-red-500 flex w-full"
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
