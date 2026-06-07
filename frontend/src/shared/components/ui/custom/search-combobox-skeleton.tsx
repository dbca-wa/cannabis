import React from "react";

interface SearchComboboxSkeletonProps {
	count?: number;
	showBadge?: boolean;
	showSubtitle?: boolean;
	className?: string;
}

/**
 * SearchComboboxSkeleton — disabled.
 * Returns null so loading states render nothing until content is ready.
 * Kept as a named export so existing imports don't break.
 */
export const SearchComboboxSkeleton: React.FC<
	SearchComboboxSkeletonProps
> = () => {
	return null;
};
