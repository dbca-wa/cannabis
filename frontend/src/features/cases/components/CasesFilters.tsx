import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { FilterContainer } from "@/shared/components/FilterContainer";
import { SearchControls } from "@/shared/components/SearchControls";
import { casesSearchStore } from "@/app/stores/derived/cases-search.store";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import {
	OfficerSearchComboBox,
	StationSearchComboBox,
} from "@/shared/components/police";
import { useDebounce } from "@/shared/hooks/core/useDebounce";

const PHASE_OPTIONS = [
	{ value: "all", label: "All States" },
	{ value: "assessment", label: "Awaiting Assessment" },
	{ value: "data_entry", label: "Awaiting Data Entry" },
	{ value: "unsigned_generation", label: "Awaiting Unsigned Cert" },
	{ value: "botanist_signoff", label: "Awaiting Signature" },
	{ value: "invoicing", label: "Awaiting Invoice" },
	{ value: "send_emails", label: "Awaiting Email" },
	{ value: "complete", label: "Complete" },
];

export const CasesFilters = observer(() => {
	const store = casesSearchStore;

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
					placeholder="Search by reference, ID, officer, or defendant..."
					value={localSearch}
					onChange={(e) => setLocalSearch(e.target.value)}
					variant="search"
					className="pl-9"
					aria-label="Search cases"
				/>
			</div>

			{/* Filter grid — responsive columns */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				{/* Phase dropdown */}
				<Select
					value={store.state.filters.phase}
					onValueChange={(value) => store.setFilters({ phase: value })}
				>
					<SelectTrigger
						aria-label="Filter by phase"
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
				<UserSearchCombobox
					value={store.state.filters.botanist}
					onValueChange={(id) => store.setFilters({ botanist: id })}
					placeholder="Filter by botanist..."
					allowCreate={false}
					roleFilter="botanist"
				/>

				{/* Officer filter */}
				<OfficerSearchComboBox
					value={store.state.filters.officer}
					onValueChange={(id) => store.setFilters({ officer: id })}
					placeholder="Filter by officer..."
					allowCreate={false}
				/>

				{/* Station filter */}
				<StationSearchComboBox
					value={store.state.filters.station}
					onValueChange={(id) => store.setFilters({ station: id })}
					placeholder="Filter by station..."
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
