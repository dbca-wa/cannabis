import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import HamburgerMenu from "./HamburgerMenu";
import MobileSidebar from "./MobileSidebar";
import { NavigationProvider } from "@/app/providers/navigation.provider";
import { useUIStore } from "@/app/providers/store.provider";
import { OutdatedBuildNotice } from "@/shared/components/feedback/OutdatedBuildNotice";
import { observer } from "mobx-react-lite";

const MainLayout = observer(function MainLayout() {
	const uiStore = useUIStore();

	return (
		<NavigationProvider>
			{/*
			  The shell is exactly the viewport tall (h-full of the height:100%
			  root chain) and clips its own overflow, so the document never
			  scrolls. The sidebar is fixed out of flow and `main` is the only
			  scroll container.
			*/}
			<div className="flex h-full w-full overflow-hidden bg-[#fafbfb] dark:bg-background">
				{/* Desktop sidebar — full height, does not scroll with content */}
				<div className="hidden lg:flex h-full">
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

				{/*
				  The only scroll container. `contain: layout paint` keeps its
				  overflow from leaking into the document's scroll height: without
				  it, a child taller than the viewport that paints outside main's
				  box (the react-pdf certificate canvas on the process case page)
				  made `html` itself scrollable, so the page scrolled behind the
				  fixed sidebar into blank space. Measured: it drops html
				  scrollHeight from 2092 back to the 900 viewport. `h-full` fills
				  the fixed-height shell via flex rather than its own 100vh.
				*/}
				<main className="flex-1 min-w-0 h-full overflow-y-auto [contain:layout_paint]">
					<div className="max-w-[1400px] mx-auto px-8 py-8 pt-14 lg:pt-8">
						<Outlet />
					</div>
				</main>

				<OutdatedBuildNotice />
			</div>
		</NavigationProvider>
	);
});

export default MainLayout;
