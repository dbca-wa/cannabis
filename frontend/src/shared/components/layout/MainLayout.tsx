import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import { NavigationProvider } from "@/app/providers/navigation.provider";
import { cn } from "@/shared/utils/index";

const MainLayout = () => {
	return (
		<NavigationProvider>
			<div
				className={cn(
					"flex h-screen max-h-screen transition-colors duration-200",
					"dark:bg-gray-900 dark:text-white",
					// Light theme
					"bg-gray-50 text-gray-900"
				)}
			>
				<Sidebar />
				<div className="flex flex-col flex-1 overflow-hidden">
					{/* Main content area with theme-aware background */}
					<main
						className={cn(
							"flex-1 overflow-y-auto select-none transition-colors duration-200",
							// Dark theme main content
							"dark:bg-gray-800 dark:text-white",
							// Light theme main content
							"bg-gray-100 text-gray-900"
						)}
					>
						<Outlet />
					</main>
				</div>
			</div>
		</NavigationProvider>
	);
};

export default MainLayout;
