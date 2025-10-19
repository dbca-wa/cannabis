import { cn } from "@/shared/utils/index";
import type { ReactNode } from "react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { observer } from "mobx-react-lite";
import {
	Breadcrumb,
	type BreadcrumbItem,
} from "@/shared/components/ui/breadcrumb";
import { ErrorBoundary } from "@/shared/components/feedback/ErrorBoundary";
import { PreferenceSyncNotification } from "@/shared/components/feedback/PreferenceSyncNotification";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import {
	useKeyboardShortcuts,
	commonShortcuts,
} from "@/shared/hooks/ui/useKeyboardShortcuts";
import { useUIStore } from "@/app/providers/store.provider";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import UserMenu from "./UserMenu";
import HamburgerMenu from "./HamburgerMenu";
import MobileSidebar from "./MobileSidebar";

interface ContentLayoutProps {
	children: ReactNode;
	header?: ReactNode;
	breadcrumbs?: BreadcrumbItem[];
	showHomeBreadcrumb?: boolean;
	className?: string;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
	showErrorBoundary?: boolean;
}

const ContentLayout = observer(
	({
		children,
		header,
		breadcrumbs,
		showHomeBreadcrumb = true,
		className,
		maxWidth, // Optional override, defaults to UIStore preference
		showErrorBoundary = true,
	}: ContentLayoutProps) => {
		const navigate = useNavigate();
		const uiStore = useUIStore();
		const { isDesktop } = useBreakpoint();
		const [showGlobalShortcutsHelp, setShowGlobalShortcutsHelp] =
			useState(false);

		// Use maxWidth prop or fall back to UIStore default
		const contentWidth = maxWidth || uiStore.defaultContentWidth;
		const maxWidthClass = uiStore.getMaxWidthClass(contentWidth);

		// Global keyboard shortcuts
		const globalShortcuts = useMemo(
			() => [
				commonShortcuts.navigation.home(() => navigate("/")),
				commonShortcuts.navigation.users(() => navigate("/users")),
				commonShortcuts.navigation.police(() => navigate("/police")),
				commonShortcuts.navigation.admin(() => navigate("/admin")),
				commonShortcuts.general.toggleTheme(() =>
					uiStore.toggleTheme()
				),
				commonShortcuts.general.help(() =>
					setShowGlobalShortcutsHelp(true)
				),
			],
			[navigate, uiStore]
		);

		useKeyboardShortcuts({ shortcuts: globalShortcuts });

		const content = (
			<div className="flex flex-col h-full">
				{/* Preference sync notification - shows once per user */}
				<PreferenceSyncNotification />

				{/* Mobile Sidebar */}
				<MobileSidebar
					isOpen={uiStore.isMobileSidebarOpen}
					onClose={() => uiStore.setMobileSidebarOpen(false)}
				/>

				{/* Breadcrumbs section - always show for user menu */}
				<div className="w-full px-4 sm:px-8 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{/* Hamburger menu for mobile and tablet (below desktop) */}
							{!isDesktop && (
								<HamburgerMenu
									isOpen={uiStore.isMobileSidebarOpen}
									onToggle={() =>
										uiStore.toggleMobileSidebar()
									}
								/>
							)}
							{breadcrumbs && breadcrumbs.length > 0 ? (
								<Breadcrumb
									items={breadcrumbs}
									showHome={showHomeBreadcrumb}
								/>
							) : showHomeBreadcrumb ? (
								<Breadcrumb items={[]} showHome={true} />
							) : (
								<div /> // Empty div to maintain layout
							)}
						</div>
						<UserMenu variant="breadcrumb" />
					</div>
				</div>

				{/* Full-width header section */}
				{header && (
					<div className="w-full px-4 sm:px-8 py-5 border-b border-gray-200 dark:border-gray-700">
						<div className={cn("mx-auto", maxWidthClass)}>
							{header}
						</div>
					</div>
				)}

				{/* Centered content section */}
				<div
					className={cn(
						"flex-1 overflow-y-auto text-black",
						className
					)}
				>
					<div
						className={cn(
							"mx-auto px-4 sm:px-8 py-6",
							maxWidthClass
						)}
					>
						{children}
					</div>
				</div>
			</div>
		);

		const finalContent = (
			<>
				{content}
				{/* Global Keyboard Shortcuts Help */}
				<KeyboardShortcutsHelp
					open={showGlobalShortcutsHelp}
					onOpenChange={setShowGlobalShortcutsHelp}
					shortcuts={globalShortcuts}
					title="Global Keyboard Shortcuts"
					description="Use these keyboard shortcuts to navigate the application quickly."
				/>
			</>
		);

		if (showErrorBoundary) {
			return <ErrorBoundary>{finalContent}</ErrorBoundary>;
		}

		return finalContent;
	}
);

export default ContentLayout;
