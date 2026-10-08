import Sidebar from "./Sidebar";
import HamburgerMenu from "./HamburgerMenu";
import MobileSidebar from "./MobileSidebar";
import { NavigationProvider } from "@/app/providers/navigation.provider";
import { useUIStore } from "@/app/providers/store.provider";
import { OutdatedBuildNotice } from "@/shared/components/feedback/OutdatedBuildNotice";
import { PracticeModeBanner } from "@/features/practice/components/PracticeModeBanner";
import { PracticeBriefSheet } from "@/features/practice/components/PracticeBriefSheet";
import { PracticeSheetReopenTab } from "@/features/practice/components/PracticeSheetReopenTab";
import { PracticeSheetProvider } from "@/features/practice/components/PracticeSheetContext";
import { usePracticeSheet } from "@/features/practice/components/practiceSheet.context";
import { usePracticeMode } from "@/features/practice/hooks/usePracticeMode";
import { Outlet as RouterOutlet } from "react-router";
import { observer } from "mobx-react-lite";

/**
 * The scrolling content region. Reserves room on the right for the practice
 * guide sheet when it is open, so the fixed sheet never covers page content.
 */
const MainContent = () => {
	const { isOpen, guideEnabled } = usePracticeSheet();
	const { isOn } = usePracticeMode();
	// The docked sheet is visible — and so needs room reserved — whenever it is
	// open and either practice mode is on (the brief) or the reference guide is
	// toggled on outside practice mode. Mirrors the sheet's own render gate.
	const reserveForSheet = isOpen && (isOn || guideEnabled);

	return (
		<main
			className={`flex-1 min-w-0 h-full overflow-y-auto [contain:layout_paint] ${
				reserveForSheet ? "lg:pr-[360px]" : ""
			}`}
		>
			<PracticeModeBanner />
			<div className="max-w-[1400px] mx-auto px-8 py-8 pt-14 lg:pt-8">
				<RouterOutlet />
			</div>
		</main>
	);
};

const MainLayout = observer(function MainLayout() {
	const uiStore = useUIStore();

	return (
		<NavigationProvider>
			<PracticeSheetProvider>
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
					<MainContent />

					{/* Always-accessible practice brief and guidance, docked right.
				    Fixed and above modal overlays; MainContent reserves room so it
				    never covers the page content. */}
					<PracticeBriefSheet />
					<PracticeSheetReopenTab />

					<OutdatedBuildNotice />
				</div>
			</PracticeSheetProvider>
		</NavigationProvider>
	);
});

export default MainLayout;
