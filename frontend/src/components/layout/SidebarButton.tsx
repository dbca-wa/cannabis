import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/rootStore";
import { observer } from "mobx-react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type SidebarButtonProps = {
	icon: React.ReactNode;
	activeIcon: React.ReactNode;
	name: string;
	adminOnly: boolean;
	hideName?: boolean;
	tooltipContent?: React.ReactNode;
};

const HomeSidebarItemContainer = ({
	children,
	even,
}: {
	children: React.ReactNode;
	even: boolean;
}) => {
	return (
		<div
			className={cn(
				"select-none",
				even
					? "w-full h-18 flex justify-center items-center"
					: "w-full h-[74px] flex flex-col justify-start pt-1"
			)}
		>
			{children}
		</div>
	);
};

const SidebarButton = observer(
	({
		adminOnly,
		icon,
		activeIcon,
		name,
		hideName,
		tooltipContent,
	}: SidebarButtonProps) => {
		const uiStore = useUIStore();
		const navigate = useNavigate();

		const handleClick = () => {
			const route = uiStore.getRouteForHomeSidebarItem(name);
			navigate(route);
		};

		return (
			<HomeSidebarItemContainer even={false}>
				<div className="flex w-full justify-center relative">
					{tooltipContent ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									onClick={handleClick}
									variant={"sidebarButton"}
									className={cn(
										uiStore.isActiveSidebarItem(name)
											? "cannabis-green-dark cannabis-active-button"
											: "text-[#6c5598] bg-none"
									)}
								>
									{uiStore.isActiveSidebarItem(name)
										? activeIcon
										: icon}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">
								{tooltipContent}
							</TooltipContent>
						</Tooltip>
					) : (
						<Button
							onClick={handleClick}
							variant={"sidebarButton"}
							className={cn(
								uiStore.isActiveSidebarItem(name)
									? "cannabis-green-dark cannabis-active-button"
									: "cannabis-green bg-none"
							)}
						>
							{uiStore.isActiveSidebarItem(name)
								? activeIcon
								: icon}
						</Button>
					)}
				</div>

				{!hideName ? (
					<div
						className={cn(
							"w-full text-center text-[11px] mt-0.5",
							uiStore.isActiveSidebarItem(name)
								? "cannabis-green-dark"
								: "cannabis-green"
						)}
					>
						<span>{name}</span>
					</div>
				) : null}
			</HomeSidebarItemContainer>
		);
	}
);

export default SidebarButton;
