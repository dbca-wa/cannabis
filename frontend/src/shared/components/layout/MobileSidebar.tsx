import { observer } from "mobx-react-lite";
import { Fragment } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router";
import SidebarButton from "./SidebarButton";
import { getSidebarItems } from "@/app/config/routes.config";
import { cn } from "@/shared/utils/index";
import { useAuth } from "@/features/auth";
import { useSidebarItem } from "@/shared/hooks/ui/useSidebarItem";
import { Button } from "@/shared/components/ui/button";

interface MobileSidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

const MobileSidebar = observer(({ isOpen, onClose }: MobileSidebarProps) => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const { isActiveSidebarItem } = useSidebarItem();
	const isHomeActive = isActiveSidebarItem("Home");

	const handleHomeClick = () => {
		// Don't navigate if already on home
		if (isHomeActive) {
			onClose();
			return;
		}
		navigate("/");
		onClose();
	};

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-[998] lg:hidden"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Mobile Sidebar */}
			<aside
				className={cn(
					"fixed left-0 top-0 h-full w-64 z-[999] lg:hidden",
					"flex flex-col py-4 px-3",
					"border-r shadow-lg transition-transform duration-300 ease-in-out",
					"overflow-visible", // Ensure logo effects aren't clipped
					// Dark theme styles
					"dark:bg-gray-900 dark:border-gray-700",
					// Light theme styles
					"bg-white border-gray-200",
					// Animation
					isOpen ? "translate-x-0" : "-translate-x-full"
				)}
			>
				{/* Header with logo and close button */}
				<div className="flex items-center mb-6 px-1 gap-2">
					{/* Clickable logo and text for home navigation - expanded click area */}
					<button
						onClick={handleHomeClick}
						className={cn(
							"flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
							"hover:bg-gray-100 dark:hover:bg-gray-800",
							"focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
							"group cursor-pointer flex-1 mr-2", // flex-1 to expand, mr-2 for spacing from close button
							isHomeActive && [
								"bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50",
								"border border-blue-200 dark:border-blue-800",
								"shadow-sm",
							]
						)}
						aria-label="Navigate to home"
					>
						<div className="flex-shrink-0 relative z-10 w-10 h-10 flex items-center justify-center">
							{/* Simple Cannabis SVG for mobile - with hover effects */}
							<svg
								width="40"
								height="40"
								viewBox="0 0 100 100"
								className={cn(
									"transition-all duration-200",
									"group-hover:scale-105 group-hover:drop-shadow-sm",
									isHomeActive
										? "text-blue-600 dark:text-blue-400"
										: "text-green-600 dark:text-green-400"
								)}
							>
								<defs>
									<linearGradient
										id="mobileLeafGradient"
										x1="0%"
										y1="0%"
										x2="100%"
										y2="100%"
									>
										{isHomeActive ? (
											<>
												<stop
													offset="0%"
													stopColor="#2563eb"
												/>
												<stop
													offset="50%"
													stopColor="#1d4ed8"
												/>
												<stop
													offset="100%"
													stopColor="#1e40af"
												/>
											</>
										) : (
											<>
												<stop
													offset="0%"
													stopColor="#22c55e"
												/>
												<stop
													offset="50%"
													stopColor="#16a34a"
												/>
												<stop
													offset="100%"
													stopColor="#15803d"
												/>
											</>
										)}
									</linearGradient>
								</defs>
								<g transform="translate(50,50)">
									{/* Main center leaf */}
									<path
										d="M0,-35 Q-3,-25 -2,-10 Q-1,0 0,5 Q1,0 2,-10 Q3,-25 0,-35 Z"
										fill="url(#mobileLeafGradient)"
									/>
									{/* Left side leaves */}
									<path
										d="M-8,-30 Q-12,-22 -10,-8 Q-8,0 -6,3 Q-4,-2 -5,-12 Q-6,-22 -8,-30 Z"
										fill="url(#mobileLeafGradient)"
										transform="rotate(-15)"
									/>
									<path
										d="M-15,-25 Q-18,-18 -16,-6 Q-14,0 -12,2 Q-10,-3 -11,-10 Q-13,-18 -15,-25 Z"
										fill="url(#mobileLeafGradient)"
										transform="rotate(-30)"
									/>
									<path
										d="M-20,-18 Q-22,-12 -20,-4 Q-18,0 -16,1 Q-14,-2 -15,-6 Q-17,-12 -20,-18 Z"
										fill="url(#mobileLeafGradient)"
										transform="rotate(-50)"
									/>
									{/* Right side leaves */}
									<path
										d="M8,-30 Q12,-22 10,-8 Q8,0 6,3 Q4,-2 5,-12 Q6,-22 8,-30 Z"
										fill="url(#mobileLeafGradient)"
										transform="rotate(15)"
									/>
									<path
										d="M15,-25 Q18,-18 16,-6 Q14,0 12,2 Q10,-3 11,-10 Q13,-18 15,-25 Z"
										fill="url(#mobileLeafGradient)"
										transform="rotate(30)"
									/>
									<path
										d="M20,-18 Q22,-12 20,-4 Q18,0 16,1 Q14,-2 15,-6 Q17,-12 20,-18 Z"
										fill="url(#mobileLeafGradient)"
										transform="rotate(50)"
									/>
								</g>
							</svg>
						</div>
						<span
							className={cn(
								"text-lg font-semibold transition-colors duration-200",
								"bg-gradient-to-r bg-clip-text text-transparent",
								isHomeActive
									? "from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400"
									: "from-gray-800 to-gray-600 dark:from-gray-200 dark:to-gray-400",
								"group-hover:from-blue-600 group-hover:to-purple-600",
								"dark:group-hover:from-blue-400 dark:group-hover:to-purple-400"
							)}
						>
							Cannabis
						</span>
					</button>

					{/* Close button - flex-shrink-0 to maintain size */}
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						className="p-2 h-10 w-10 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
						aria-label="Close menu"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{/* Navigation Items */}
				<nav className="flex flex-col space-y-1 flex-1">
					{getSidebarItems()
						.filter((item) => item.name !== "Home")
						.map((item) => {
							// Skip rendering admin-only items for non-admins
							if (
								item.adminOnly &&
								!user?.is_superuser &&
								!user?.is_staff
							) {
								return null;
							}

							return (
								<Fragment key={item.name}>
									<SidebarButton
										name={item.name}
										hideName={false}
										adminOnly={item.adminOnly}
										icon={item.icon}
										activeIcon={item.activeIcon}
										tooltipContent={item.tooltipContent}
										isMobile={true}
										onMobileClick={onClose}
									/>
								</Fragment>
							);
						})}
				</nav>
			</aside>
		</>
	);
});

export default MobileSidebar;
