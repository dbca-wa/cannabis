import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { FilterContainer } from "@/shared/components/FilterContainer";
import { SearchControls } from "@/shared/components/SearchControls";
import { stationsSearchStore } from "@/app/stores/derived/stations-search.store";
import { useDebounce } from "@/shared/hooks/core/useDebounce";

export const StationsFilters = observer(() => {
	const store = stationsSearchStore;

	// Local state for immediate UI feedback on search input
	const [localSearch, setLocalSearch] = useState(store.state.searchTerm);
	const debouncedSearch = useDebounce(localSearch, 300);

	// Sync debounced value to store
	useEffect(() => {
		if (debouncedSearch !== store.state.searchTerm) {
			store.setSearchTerm(debouncedSearch);
		}
	}, [debouncedSearch]);

	// Sync store → local when store resets (e.g. clearSearchAndFilters)
	useEffect(() => {
		if (store.state.searchTerm !== localSearch) {
			setLocalSearch(store.state.searchTerm);
		}
	}, [store.state.searchTerm]);

	return (
		<FilterContainer>
			{/* Search input — full width */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400" />
				<Input
					type="text"
					placeholder="Search stations..."
					value={localSearch}
					onChange={(e) => setLocalSearch(e.target.value)}
					variant="search"
					className="pl-9"
					aria-label="Search stations"
				/>
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
