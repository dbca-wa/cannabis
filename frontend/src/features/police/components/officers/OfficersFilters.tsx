import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { FilterContainer } from "@/shared/components/FilterContainer";
import { SearchControls } from "@/shared/components/SearchControls";
import { officersSearchStore } from "@/app/stores/derived/officers-search.store";
import { StationSearchComboBox } from "@/shared/components/police";
import { useDebounce } from "@/shared/hooks/core/useDebounce";

const RANK_OPTIONS_PRIMARY = [
	{ value: "unsworn_officer", label: "Unsworn Officer" },
	{ value: "sworn_officer", label: "Sworn Officer" },
];

const RANK_OPTIONS_SECONDARY = [
	{ value: "constable", label: "Constable" },
	{ value: "detective", label: "Detective" },
	{
		value: "detective_first_class_constable",
		label: "Detective First Class Constable",
	},
	{ value: "detective_senior_constable", label: "Detective Senior Constable" },
	{ value: "first_class_constable", label: "First Class Constable" },
	{ value: "inspector", label: "Inspector" },
	{ value: "police_constable", label: "Police Constable" },
	{ value: "senior_constable", label: "Senior Constable" },
	{ value: "senior_detective", label: "Senior Detective" },
	{ value: "sergeant", label: "Sergeant" },
	{ value: "unknown", label: "Unknown" },
	{ value: "other", label: "Other" },
];

export const OfficersFilters = observer(() => {
	const store = officersSearchStore;

	// Local state for immediate UI feedback on search input
	const [localSearch, setLocalSearch] = useState(store.state.searchTerm);
	const debouncedSearch = useDebounce(localSearch, 300);

	// Sync debounced value to store
	useEffect(() => {
		if (debouncedSearch !== store.state.searchTerm) {
			store.setSearchTerm(debouncedSearch);
		}
	}, [debouncedSearch, store]);

	// Sync store → local when store resets (e.g. clearSearchAndFilters)
	useEffect(() => {
		if (store.state.searchTerm !== localSearch) {
			setLocalSearch(store.state.searchTerm);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.state.searchTerm]);

	return (
		<FilterContainer>
			{/* Search input — full width */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400" />
				<Input
					type="text"
					placeholder="Search officers..."
					value={localSearch}
					onChange={(e) => setLocalSearch(e.target.value)}
					variant="search"
					className="pl-9"
					aria-label="Search officers"
				/>
			</div>

			{/* Filter grid — responsive columns */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{/* Station filter */}
				<StationSearchComboBox
					value={store.state.filters.station}
					onValueChange={(id) => store.setFilters({ station: id })}
					placeholder="Filter by station..."
				/>

				{/* Rank dropdown */}
				<Select
					value={store.state.filters.rank}
					onValueChange={(value) => store.setFilters({ rank: value })}
				>
					<SelectTrigger aria-label="Filter by rank" className="cursor-pointer">
						<SelectValue placeholder="All Ranks" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Ranks</SelectItem>
						{RANK_OPTIONS_PRIMARY.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
						<SelectSeparator />
						{RANK_OPTIONS_SECONDARY.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Search controls */}
			<SearchControls
				saveSearch={store.state.saveSearch}
				onToggleSaveSearch={() => store.toggleSaveSearch()}
				filterCount={store.filterCount}
				onClearFilters={() => store.clearSearchAndFilters()}
			/>
		</FilterContainer>
	);
});
