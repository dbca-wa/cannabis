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
		(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
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
			{/* Inline styles exactly matching CannabisLogo approach */}
			<style
				dangerouslySetInnerHTML={{
					__html: `
					@keyframes gentle-pulse {
						0%, 100% { opacity: 0.4; transform: scale(1); }
						50% { opacity: 0.7; transform: scale(1.05); }
					}

					@keyframes float {
						0%, 100% { transform: translateY(0px); }
						50% { transform: translateY(-3px); }
					}

					@keyframes ease-back {
						0% { transform: translateY(-3px); }
						100% { transform: translateY(0px); }
					}

					.cannabis-logo-container {
						position: relative;
						z-index: 10;
						display: flex;
						align-items: center;
						justify-content: center;
						cursor: pointer;
					}

					/* Cannabis Logo should float when Home is active (like sidebar buttons) */
					.cannabis-logo-active {
						animation: float 2s ease-in-out infinite !important;
					}

					/* Cannabis Logo should float on hover */
					.cannabis-logo-container:hover {
						animation: float 2s ease-in-out infinite;
					}

					/* Smooth return when not hovering (unless active) */
					.cannabis-logo-container:not(:hover):not(.cannabis-logo-active) {
						animation: ease-back 0.6s ease-out forwards;
					}

					/* Prevent jumping during click */
					.cannabis-logo-container:active {
						animation: none !important;
						transform: none !important;
					}

					.sidebar-aura-container {
						position: relative;
						z-index: 10;
						display: flex;
						align-items: center;
						justify-content: center;
					}

					/* Dark theme sidebar aura */
					.dark .sidebar-aura {
						content: '';
						position: absolute;
						width: 50px;
						height: 50px;
						background: radial-gradient(circle, rgba(255,200,0,0.5), rgba(200,255,0,0.4), rgba(0,255,200,0.4), rgba(0,200,255,0.4), rgba(200,0,255,0.3), rgba(255,0,200,0.3), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
						pointer-events: none;
						z-index: 0;
						opacity: 0;
						transition: opacity 0.3s ease;
					}

					/* Light theme sidebar aura - EXACT match to CannabisLogo */
					.light .sidebar-aura {
						content: '';
						position: absolute;
						width: 50px;
						height: 50px;
						background: radial-gradient(circle, rgba(67,56,202,0.4), rgba(99,102,241,0.3), rgba(139,92,246,0.3), rgba(168,85,247,0.3), rgba(192,132,252,0.2), rgba(217,70,239,0.2), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
						pointer-events: none;
						z-index: 0;
						opacity: 0;
						transition: opacity 0.3s ease;
					}

					/* Default (light theme when no .light class) - EXACT match to CannabisLogo */
					.sidebar-aura {
						content: '';
						position: absolute;
						width: 50px;
						height: 50px;
						background: radial-gradient(circle, rgba(67,56,202,0.4), rgba(99,102,241,0.3), rgba(139,92,246,0.3), rgba(168,85,247,0.3), rgba(192,132,252,0.2), rgba(217,70,239,0.2), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
						pointer-events: none;
						z-index: 0;
						opacity: 0;
						transition: opacity 0.3s ease;
						inset: 0;
						margin: auto;
					}

					.sidebar-aura-active {
						opacity: 1 !important;
						animation: gentle-pulse 2.5s ease-in-out infinite;
					}

					.sidebar-aura-container:hover .sidebar-aura {
						opacity: 0.6;
					}

					/* Active buttons should always float (like they're being hovered) */
					.sidebar-button-stable[data-active="true"] {
						animation: float 2s ease-in-out infinite !important;
					}

					/* Prevent ALL animations during click/hold state to stop jumping */
					.sidebar-button-stable:active {
						animation: none !important;
						transform: none !important;
					}

					/* Also prevent animations during the navigation transition period */
					.sidebar-button-stable[data-active="false"]:active {
						animation: none !important;
						transform: none !important;
					}
				`,
				}}
			/>
			<div className="w-full flex justify-center py-2.5 relative">
				<div className="sidebar-aura-container relative flex flex-col items-center justify-center w-full min-h-[50px]">
					{/* Sidebar Aura - always present, controlled by active state */}
					<div
						className={cn(
							"sidebar-aura absolute inset-0 m-auto",
							isActive && "sidebar-aura-active"
						)}
					/>

					{/* Button using the floating sidebar variant */}
					<Button
						onClick={handleClick}
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
