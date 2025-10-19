import { LogOut, Moon, Sun, User } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/shared/utils/index";
import { useAuth } from "@/features/auth";
import { useUIStore } from "@/app/providers/store.provider";
import { LoaderToggle } from "./LoaderToggle";

interface UserMenuProps {
	variant?: "sidebar" | "breadcrumb";
	className?: string;
}

const UserMenu = observer(
	({ variant = "breadcrumb", className }: UserMenuProps) => {
		const { user, logout } = useAuth();
		const uiStore = useUIStore();

		const handleLogout = () => {
			logout();
		};

		const handleThemeToggle = () => {
			// Toggle based on current appearance, not just theme setting
			const isCurrentlyDark =
				uiStore.currentTheme === "dark" ||
				(uiStore.currentTheme === "system" &&
					window.matchMedia("(prefers-color-scheme: dark)").matches);

			const newTheme = isCurrentlyDark ? "light" : "dark";
			uiStore.setTheme(newTheme);
		};

		const isDarkMode =
			uiStore.currentTheme === "dark" ||
			(uiStore.currentTheme === "system" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches);

		// Different styles for different variants
		const triggerStyles =
			variant === "sidebar"
				? "sidebar-utility-button"
				: "h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800";

		const themeButtonStyles =
			"h-8 w-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800";

		return (
			<div className={cn("flex items-center gap-2", className)}>
				{/* Theme Toggle - only show in breadcrumb variant */}
				{variant === "breadcrumb" && (
					<Button
						variant="ghost"
						size="icon"
						className={themeButtonStyles}
						onClick={handleThemeToggle}
					>
						{isDarkMode ? (
							<Sun className="h-4 w-4" />
						) : (
							<Moon className="h-4 w-4" />
						)}
					</Button>
				)}

				{/* User Menu */}
				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={triggerStyles}
						>
							{variant === "breadcrumb" ? (
								// Show user avatar/initial in breadcrumb
								<div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
									{user?.email?.charAt(0).toUpperCase() ||
										"U"}
								</div>
							) : (
								// Show user icon in sidebar
								<User className="size-5" />
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent
						side={variant === "sidebar" ? "right" : "bottom"}
						sideOffset={variant === "sidebar" ? 30 : 10}
						align={variant === "sidebar" ? "start" : "end"}
						className={cn(
							"z-[9999] rounded-xl w-[300px] p-0 overflow-hidden",
							"border shadow-xl transition-colors duration-200",
							// Dark theme
							"dark:bg-gray-900 dark:border-gray-700 dark:shadow-green-400/20",
							// Light theme
							"light:bg-white light:border-gray-200 light:shadow-gray-900/20"
						)}
					>
						{/* Header Section - User Info */}
						<div
							className={cn(
								"p-4 pb-0 transition-colors duration-200",
								"dark:border-gray-700",
								"light:border-gray-200"
							)}
						>
							<div className="flex items-center gap-3">
								{/* Avatar Placeholder */}
								<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
									{user?.email?.charAt(0).toUpperCase() ||
										"U"}
								</div>

								{/* User Details */}
								<div className="flex-1 min-w-0">
									<p
										className={cn(
											"font-medium truncate text-sm transition-colors duration-200",
											"dark:text-gray-100",
											"light:text-gray-900"
										)}
									>
										{user?.email || "Unknown User"}
									</p>
									<div
										className={cn(
											"flex items-center gap-2 mt-1 text-xs transition-colors duration-200",
											"dark:text-gray-400",
											"light:text-gray-500"
										)}
									>
										{user?.role || "User"} •{" "}
										{user?.is_superuser
											? "Super Admin"
											: user?.is_staff
											? "Staff"
											: "User"}
									</div>
								</div>
							</div>
						</div>

						{/* Loader Toggle Section - always show */}
						<div
							className={cn(
								"p-4 border-b transition-colors duration-200",
								"dark:border-gray-700",
								"light:border-gray-200"
							)}
						>
							<LoaderToggle />
						</div>

						{/* Theme Toggle Section - only show in breadcrumb variant */}
						{variant === "breadcrumb" && (
							<div
								className={cn(
									"p-4 border-b transition-colors duration-200",
									"dark:border-gray-700",
									"light:border-gray-200"
								)}
							>
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">
										Current Theme
									</span>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleThemeToggle}
										className="h-8 px-3"
									>
										{isDarkMode ? (
											<>
												<Moon className="h-4 w-4 mr-2" />
												Dark
											</>
										) : (
											<>
												<Sun className="h-4 w-4 mr-2" />
												Light
											</>
										)}
									</Button>
								</div>
							</div>
						)}

						{/* Actions Section */}
						<div
							className={cn(
								"p-4 transition-colors duration-200",
								"dark:bg-gray-800/50",
								"light:bg-gray-50"
							)}
						>
							<Button
								variant="outline"
								onClick={handleLogout}
								className={cn(
									"w-full justify-center gap-2 border transition-colors duration-200",
									"text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300",
									"dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50 dark:border-red-800"
								)}
							>
								<LogOut size={16} />
								<span>Logout</span>
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		);
	}
);

export default UserMenu;
