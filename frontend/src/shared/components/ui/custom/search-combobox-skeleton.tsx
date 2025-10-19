import React from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/utils";

interface SearchComboboxSkeletonProps {
	// Number of skeleton items to show (3-8 recommended)
	count?: number;
	// Whether to show badge skeleton (for users and officers)
	showBadge?: boolean;
	// Whether to show subtitle skeleton (for additional info)
	showSubtitle?: boolean;
	// Additional className for the container
	className?: string;
}

/**
 * SearchComboboxSkeleton provides consistent loading skeletons for search comboboxes
 * that match the layout of actual result items (icon, name, subtitle, badge)
 */
export const SearchComboboxSkeleton: React.FC<SearchComboboxSkeletonProps> = ({
	count = 4,
	showBadge = true,
	showSubtitle = true,
	className,
}) => {
	// Ensure count is within reasonable bounds (3-8 items)
	const itemCount = Math.min(Math.max(count, 3), 8);

	return (
		<div className={cn("p-2 space-y-2", className)}>
			{[...Array(itemCount)].map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-2 px-2 py-1.5 rounded-sm"
				>
					{/* Check icon placeholder */}
					<Skeleton className="h-4 w-4 rounded-sm" />

					{/* Entity icon placeholder (User, Building, Shield) */}
					<Skeleton className="h-4 w-4 rounded-sm" />

					{/* Content area */}
					<div className="flex-1 min-w-0 space-y-1">
						{/* Main name/title */}
						<Skeleton
							className="h-4 w-full max-w-[180px]"
							style={{ width: `${60 + Math.random() * 40}%` }}
						/>

						{/* Subtitle (email, address, badge number + station) */}
						{showSubtitle && (
							<Skeleton
								className="h-3 w-full max-w-[140px]"
								style={{ width: `${40 + Math.random() * 30}%` }}
							/>
						)}
					</div>

					{/* Badge placeholder (role, rank) */}
					{showBadge && (
						<Skeleton className="h-5 w-16 rounded-full" />
					)}
				</div>
			))}
		</div>
	);
};
