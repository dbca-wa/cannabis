import { observer } from "mobx-react-lite";
import { Menu, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/index";

interface HamburgerMenuProps {
	isOpen: boolean;
	onToggle: () => void;
	className?: string;
}

const HamburgerMenu = observer(
	({ isOpen, onToggle, className }: HamburgerMenuProps) => {
		return (
			<Button
				variant="ghost"
				size="sm"
				onClick={onToggle}
				className={cn(
					"p-2 h-8 w-8 flex items-center justify-center",
					"hover:bg-gray-100 dark:hover:bg-gray-800",
					"transition-colors duration-200",
					className
				)}
				aria-label={isOpen ? "Close menu" : "Open menu"}
			>
				{isOpen ? (
					<X className="h-4 w-4" />
				) : (
					<Menu className="h-4 w-4" />
				)}
			</Button>
		);
	}
);

export default HamburgerMenu;
