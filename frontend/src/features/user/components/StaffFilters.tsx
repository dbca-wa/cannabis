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
import { staffSearchStore } from "@/app/stores/derived/staff-search.store";
import { useDebounce } from "@/shared/hooks/core/useDebounce";

const ROLE_OPTIONS = [
	{ value: "all", label: "All Roles" },
	{ value: "botanist", label: "Botanist" },
	{ value: "finance", label: "Finance" },
	{ value: "none", label: "No Roles" },
];

const STATUS_OPTIONS = [
	{ value: "all", label: "All Statuses" },
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
];

export const StaffFilters = observer(() => {
	const store = staffSearchStore;

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
	}, [store.state.searchTerm, localSearch]);

	return (
		<FilterContainer>
			{/* Search input — full width */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400" />
				<Input
					type="text"
					placeholder="Search staff..."
					value={localSearch}
					onChange={(e) => setLocalSearch(e.target.value)}
					variant="search"
					className="pl-9"
					aria-label="Search staff"
				/>
			</div>

			{/* Filter grid — responsive columns */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{/* Role dropdown */}
				<Select
					value={store.state.filters.role}
					onValueChange={(value) => store.setFilters({ role: value })}
				>
					<SelectTrigger aria-label="Filter by role">
						<SelectValue placeholder="All Roles" />
					</SelectTrigger>
					<SelectContent>
						{ROLE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Status dropdown */}
				<Select
					value={store.state.filters.status}
					onValueChange={(value) => store.setFilters({ status: value })}
				>
					<SelectTrigger aria-label="Filter by status">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent>
						{STATUS_OPTIONS.map((option) => (
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
