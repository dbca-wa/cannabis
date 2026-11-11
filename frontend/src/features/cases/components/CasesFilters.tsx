import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { FilterContainer } from "@/shared/components/FilterContainer";
import { PHASE_STEPS } from "@/shared/constants/phases.config";
import { SearchControls } from "@/shared/components/SearchControls";
import { casesSearchStore } from "@/app/stores/derived/cases-search.store";
import { useEphemeralSearch } from "@/shared/hooks/useEphemeralSearch";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import {
	OfficerSearchComboBox,
	StationSearchComboBox,
} from "@/shared/components/police";
import { useDebounce } from "@/shared/hooks/core/useDebounce";

// Built from the shared phase config so the filter always uses the same
// state names as the State column, the Dashboard and the guide.
const PHASE_OPTIONS = [
	{ value: "all", label: "All States" },
	...PHASE_STEPS.map((step) => ({ value: step.key, label: step.label })),
];

export const CasesFilters = observer(() => {
	const store = casesSearchStore;
	const [searchParams, setSearchParams] = useSearchParams();

	// When saved searches are off, drop the search as we leave the list so a
	// return visit (e.g. after creating a case) is never stale.
	useEphemeralSearch(store);

	// Sync URL ?phase= param to store on mount/URL change
	useEffect(() => {
		const phaseParam = searchParams.get("phase");
		if (phaseParam && phaseParam !== store.state.filters.phase) {
			store.clearSearchAndFilters();
			store.setFilters({ phase: phaseParam });
			// Remove the param from URL after applying (clean URL)
			searchParams.delete("phase");
			setSearchParams(searchParams, { replace: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams]);

	// Local state for immediate UI feedback on search input
	const [localSearch, setLocalSearch] = useState(store.state.searchTerm);
	const [localTagSearch, setLocalTagSearch] = useState(
		store.state.filters.tagSearch
	);
	const debouncedSearch = useDebounce(localSearch, 300);
	const debouncedTagSearch = useDebounce(localTagSearch, 300);

	// Sync debounced value to store
	useEffect(() => {
		if (debouncedSearch !== store.state.searchTerm) {
			store.setSearchTerm(debouncedSearch);
		}
	}, [debouncedSearch, store]);

	// Sync debounced tag search to store
	useEffect(() => {
		if (debouncedTagSearch !== store.state.filters.tagSearch) {
			store.setFilters({ tagSearch: debouncedTagSearch });
		}
	}, [debouncedTagSearch, store]);

	// Sync store → local ONLY when store resets externally (e.g. clearSearchAndFilters)
	// We track the store value and only reset local if store was cleared to empty
	useEffect(() => {
		if (store.state.searchTerm === "" && localSearch !== "") {
			// Only reset if the store was explicitly cleared (not during debounce lag)
			if (debouncedSearch !== "") {
				setLocalSearch("");
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.state.searchTerm]);

	useEffect(() => {
		if (store.state.filters.tagSearch === "" && localTagSearch !== "") {
			if (debouncedTagSearch !== "") {
				setLocalTagSearch("");
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.state.filters.tagSearch]);

	return (
		<FilterContainer>
			{/* Search inputs — tag search left of main search on desktop, below on mobile */}
			<div className="flex flex-col md:flex-row gap-3">
				<div className="relative md:w-[240px] shrink-0">
					<img
						src="/cannabis.svg"
						alt=""
						className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70 pointer-events-none"
						aria-hidden="true"
					/>
					<Input
						type="text"
						placeholder="Search by tag number..."
						value={localTagSearch}
						onChange={(e) => setLocalTagSearch(e.target.value)}
						className="pl-9 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 focus-visible:border-emerald-400 dark:focus-visible:border-emerald-600 focus-visible:ring-emerald-400/50 dark:focus-visible:ring-emerald-600/50 focus-visible:ring-[3px]"
						aria-label="Search by tag number"
					/>
				</div>
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400 pointer-events-none" />
					<Input
						type="text"
						placeholder="Search by reference, ID, officer, or defendant..."
						value={localSearch}
						onChange={(e) => setLocalSearch(e.target.value)}
						variant="search"
						className="pl-9"
						aria-label="Search cases"
					/>
				</div>
			</div>

			{/* Filter grid — columns follow the space the filters have, so they
			    do not squeeze when the practice or guide panel is open. */}
			<div className="@container">
				<div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-4 gap-3">
					{/* Phase dropdown */}
					<Select
						value={store.state.filters.phase}
						onValueChange={(value) => store.setFilters({ phase: value })}
					>
						<SelectTrigger
							aria-label="Filter by state"
							className="cursor-pointer"
						>
							<SelectValue placeholder="All States" />
						</SelectTrigger>
						<SelectContent>
							{PHASE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Botanist filter */}
					<Label htmlFor="cases-filter-botanist" className="sr-only">
						Filter by botanist
					</Label>
					<UserSearchCombobox
						id="cases-filter-botanist"
						value={store.state.filters.botanist}
						onValueChange={(id) => store.setFilters({ botanist: id })}
						placeholder="Filter by botanist..."
						allowCreate={false}
						roleFilter="botanist"
					/>

					{/* Officer filter */}
					<Label htmlFor="cases-filter-officer" className="sr-only">
						Filter by officer
					</Label>
					<OfficerSearchComboBox
						id="cases-filter-officer"
						value={store.state.filters.officer}
						onValueChange={(id) => store.setFilters({ officer: id })}
						placeholder="Filter by officer..."
						allowCreate={false}
					/>

					{/* Station filter */}
					<Label htmlFor="cases-filter-station" className="sr-only">
						Filter by station
					</Label>
					<StationSearchComboBox
						id="cases-filter-station"
						value={store.state.filters.station}
						onValueChange={(id) => store.setFilters({ station: id })}
						placeholder="Filter by station..."
					/>
				</div>
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
