import { useSidebarItem } from "@/shared/hooks/ui/useSidebarItem";
import { cn } from "@/shared/utils/index";
import { getRouteFromSidebarItem } from "@/app/config/routes.config";
import { useNavigate } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { useCallback } from "react";

type SidebarButtonProps = {
	icon: React.ReactNode;
	activeIcon: React.ReactNode;
	name: string;
	adminOnly: boolean;
	hideName?: boolean;
	tooltipContent?: React.ReactNode;
	addDivider?: boolean;
	isMobile?: boolean;
	onMobileClick?: () => void;
};

const SidebarButton = ({
	icon,
	activeIcon,
	name,
	hideName,
	isMobile = false,
	onMobileClick,
}: SidebarButtonProps) => {
	const navigate = useNavigate();
	const { isActiveSidebarItem } = useSidebarItem();
	const isActive = isActiveSidebarItem(name);

	// Memoize the click handler to prevent unnecessary re-renders
	const handleClick = useCallback(
		(
			e: React.MouseEvent<HTMLDivElement | HTMLButtonElement, MouseEvent>
		) => {
			// Prevent default to stop any button behavior that might cause jumping
			e.preventDefault();

			// If already active and not a modifier click, do nothing
			if (isActive && !(e.ctrlKey || e.metaKey)) {
				// Close mobile menu if open
				if (isMobile && onMobileClick) {
					onMobileClick();
				}
				return;
			}

			const route = getRouteFromSidebarItem(name);

			if (e.ctrlKey || e.metaKey) {
				// Ctrl+Click (Windows/Linux) or Cmd+Click (Mac) - open in new tab
				window.open(route, "_blank");
			} else {
				// Normal click - navigate in same tab
				navigate(route);
				// Close mobile menu after navigation
				if (isMobile && onMobileClick) {
					onMobileClick();
				}
			}
		},
		[isActive, name, navigate, isMobile, onMobileClick]
	);

	// Mobile version - styled to match desktop sidebar
	if (isMobile) {
		return (
			<Button
				onClick={handleClick}
				variant="ghost"
				className={cn(
					"select-none",
					"w-full justify-start gap-3 px-3 py-2.5 h-auto rounded-lg",
					"text-left font-medium transition-all duration-200",
					"hover:bg-gray-100 dark:hover:bg-gray-800",
					isActive && [
						"bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50",
						"text-blue-700 dark:text-blue-300",
						"border border-blue-200 dark:border-blue-800",
						"shadow-sm",
					]
				)}
				type="button"
			>
				<span
					className={cn(
						"flex-shrink-0 transition-colors duration-200",
						isActive
							? "text-blue-600 dark:text-blue-400"
							: "text-gray-600 dark:text-gray-400"
					)}
				>
					{isActive ? activeIcon : icon}
				</span>
				<span className="flex-1 text-sm">{name}</span>
			</Button>
		);
	}

	// Desktop version - with animations and aura
	return (
		<>
			<div
				className={cn(
					"w-full flex justify-center py-2.5 relative",
					"select-none"
				)}
				onClick={handleClick}
			>
				<div
					className={cn(
						// Hover animations for smooth transitions
						// "hover:!bg-transparent hover:animate-[float_2s_ease-in-out_infinite]",
						// Ease-back animation when not hovering for smooth return
						// "[&:not(:hover)]:animate-[ease-back_0.6s_ease-out_forwards]",
						"sidebar-aura-container relative flex flex-col items-center justify-center w-full min-h-[50px]"
					)}
				>
					{/* Sidebar Aura - always present, controlled by active state */}
					<div
						className={cn(
							"sidebar-aura absolute inset-0 m-auto",
							isActive && "sidebar-aura-active"
						)}
					/>

					{/* Button using the floating sidebar variant */}
					<Button
						variant="floatingSidebarButton"
						size="floating"
						data-active={isActive}
						className="relative z-10 sidebar-button-stable"
						type="button"
					>
						{isActive ? activeIcon : icon}
						{!hideName && (
							<span className="text-[10px] leading-tight text-center whitespace-nowrap">
								{name}
							</span>
						)}
					</Button>
				</div>
			</div>
		</>
	);
};

export default SidebarButton;
