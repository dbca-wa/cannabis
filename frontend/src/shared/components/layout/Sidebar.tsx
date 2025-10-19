import { observer } from "mobx-react-lite";
import CannabisLogo from "./CannabisLogo";
import SidebarButton from "./SidebarButton";
import { getSidebarItems } from "@/app/config/routes.config";
import { cn } from "@/shared/utils/index";
import { useAuth } from "@/features/auth";
import { Fragment } from "react";

const Sidebar = observer(() => {
	const { user } = useAuth();

	return (
		<aside
			className={cn(
				"z-[999] w-20 flex-col py-3 hidden lg:flex",
				"border-r shadow-md transition-colors duration-200",
				// Dark theme styles
				"dark:bg-gray-900 dark:border-gray-700",
				// Light theme styles
				"bg-white border-gray-200"
			)}
		>
			<div className="flex flex-col items-center space-y-4">
				{/* Cannabis Logo as Home Button */}
				<div className="mb-2">
					<CannabisLogo
						shouldAnimate={true}
						size="sm"
						variant="none"
					/>
				</div>

				{/* Navigation Items */}
				<div className="flex flex-col space-y-3 w-full items-center">
					{getSidebarItems()
						.filter((item) => item.name !== "Home")
						.map((item) => {
							// Debug logging for admin filtering
							if (item.name === "Admin") {
								console.log("Admin item check:", {
									itemName: item.name,
									adminOnly: item.adminOnly,
									userIsStaff: user?.is_staff,
									userIsSuperuser: user?.is_superuser,
									shouldShow:
										!item.adminOnly ||
										user?.is_superuser ||
										user?.is_staff,
								});
							}

							return (
								// Skip rendering admin-only items for non-admins
								(!item.adminOnly ||
									user?.is_superuser ||
									user?.is_staff) && (
									<Fragment key={item.name}>
										<SidebarButton
											name={item.name}
											hideName={false}
											adminOnly={item.adminOnly}
											icon={item.icon}
											activeIcon={item.activeIcon}
											tooltipContent={item.tooltipContent}
										/>
									</Fragment>
								)
							);
						})}
				</div>
			</div>
		</aside>
	);
});

export default Sidebar;
