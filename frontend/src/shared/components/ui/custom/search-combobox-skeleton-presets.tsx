import { SearchComboboxSkeleton } from "./search-combobox-skeleton";

// Preset configurations for different search combobox types
export const SearchComboboxSkeletonPresets = {
	// User search skeleton with role badge and email subtitle
	user: (count?: number) => (
		<SearchComboboxSkeleton
			count={count}
			showBadge={true}
			showSubtitle={true}
		/>
	),

	// Police station search skeleton with address subtitle, no badge
	station: (count?: number) => (
		<SearchComboboxSkeleton
			count={count}
			showBadge={false}
			showSubtitle={true}
		/>
	),

	// Police officer search skeleton with rank badge and badge number + station subtitle
	officer: (count?: number) => (
		<SearchComboboxSkeleton
			count={count}
			showBadge={true}
			showSubtitle={true}
		/>
	),

	// Simple search skeleton with just name, no badge or subtitle
	simple: (count?: number) => (
		<SearchComboboxSkeleton
			count={count}
			showBadge={false}
			showSubtitle={false}
		/>
	),
};
