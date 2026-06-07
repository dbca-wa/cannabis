import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import HamburgerMenu from "./HamburgerMenu";
import MobileSidebar from "./MobileSidebar";
import { NavigationProvider } from "@/app/providers/navigation.provider";
import { useUIStore } from "@/app/providers/store.provider";
import { observer } from "mobx-react-lite";

const MainLayout = observer(function MainLayout() {
	const uiStore = useUIStore();

	return (
		<NavigationProvider>
			<div className="flex min-h-screen w-full overflow-x-hidden bg-[#fafbfb] dark:bg-background">
				{/* Desktop sidebar */}
				<div className="hidden lg:flex">
					<Sidebar />
				</div>

				{/* Mobile hamburger */}
				{!uiStore.isMobileSidebarOpen && (
					<div className="lg:hidden fixed top-4 left-8 z-[1000] rounded-lg bg-card/90 backdrop-blur-sm shadow-md border border-border/40">
						<HamburgerMenu
							isOpen={false}
							onToggle={() => uiStore.toggleMobileSidebar()}
						/>
					</div>
				)}
				<MobileSidebar
					isOpen={uiStore.isMobileSidebarOpen}
					onClose={() => uiStore.setMobileSidebarOpen(false)}
				/>

				{/* Main content area — no page-level animation here */}
				<main className="flex-1 min-w-0 overflow-y-auto h-screen">
					<div className="max-w-[1400px] mx-auto px-8 py-8 pt-14 lg:pt-8">
						<Outlet />
					</div>
				</main>
			</div>
		</NavigationProvider>
	);
});

export default MainLayout;
