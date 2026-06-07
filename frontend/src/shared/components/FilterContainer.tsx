import type { ReactNode } from "react";
import { cn } from "@/shared/utils/style.utils";

interface FilterContainerProps {
	children: ReactNode;
	className?: string;
}

/** Bordered wrapper for page-specific filter inputs. */
export const FilterContainer = ({
	children,
	className,
}: FilterContainerProps) => {
	return (
		<div
			className={cn(
				"border border-border rounded-xl p-4 space-y-3 shadow-md",
				className
			)}
		>
			{children}
		</div>
	);
};
