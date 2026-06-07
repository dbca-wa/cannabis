import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { logger } from "@/shared/services/logger.service";
import { makeObservable, computed, action } from "mobx";

export interface StaffSearchFilters {
	role: string;
	status: string;
}

interface StaffSearchStoreState extends BaseStoreState {
	searchTerm: string;
	filters: StaffSearchFilters;
	currentPage: number;
	totalPages: number;
	totalResults: number;
	saveSearch: boolean;
}

const STORAGE_KEY = "staffSearchState";

const STAFF_DEFAULT_FILTERS: StaffSearchFilters = {
	role: "all",
	status: "all",
};

const INITIAL_STATE: StaffSearchStoreState = {
	loading: false,
	error: null,
	initialised: false,
	searchTerm: "",
	filters: { ...STAFF_DEFAULT_FILTERS },
	currentPage: 1,
	totalPages: 1,
	totalResults: 0,
	saveSearch: true,
};

export class StaffSearchStore extends BaseStore<StaffSearchStoreState> {
	constructor() {
		super({ ...INITIAL_STATE });

		makeObservable(this, {
			setSearchTerm: action,
			setFilters: action,
			setCurrentPage: action,
			setPagination: action,
			resetFilters: action,
			toggleSaveSearch: action,
			setSaveSearch: action,
			clearSearchAndFilters: action,
			setTotalResults: action,
			reset: action,
			hasActiveFilters: computed,
			filterCount: computed,
			searchParams: computed,
		});

		this.loadFromStorage();
	}

	/**
	 * Sets the search term and resets to page 1.
	 */
	setSearchTerm(term: string) {
		this.state.searchTerm = term;
		this.setCurrentPage(1);
	}

	/**
	 * Updates filters with a partial object and resets to page 1.
	 */
	setFilters(filters: Partial<StaffSearchFilters>) {
		this.state.filters = { ...this.state.filters, ...filters };
		this.setCurrentPage(1);
	}

	/**
	 * Sets the current page number and persists to storage.
	 */
	setCurrentPage(page: number) {
		this.state.currentPage = page;
		this.saveToStorage();
	}

	/**
	 * Sets pagination metadata from API response.
	 */
	setPagination(data: { totalPages: number; totalResults: number }) {
		this.state.totalPages = data.totalPages;
		this.state.totalResults = data.totalResults;
	}

	/**
	 * Sets the total number of results.
	 */
	setTotalResults(total: number) {
		this.state.totalResults = total;
	}

	/**
	 * Resets filters and search term to defaults, resets page to 1.
	 */
	resetFilters() {
		this.state.filters = { ...STAFF_DEFAULT_FILTERS };
		this.state.searchTerm = "";
		this.state.currentPage = 1;
		this.saveToStorage();
	}

	/**
	 * Toggles the saveSearch preference and persists accordingly.
	 */
	toggleSaveSearch() {
		this.state.saveSearch = !this.state.saveSearch;
		this.saveToStorage();
	}

	/**
	 * Sets the saveSearch preference explicitly.
	 */
	setSaveSearch(value: boolean) {
		this.state.saveSearch = value;
		this.saveToStorage();
	}

	/**
	 * Clears all search state and removes from localStorage.
	 */
	clearSearchAndFilters() {
		this.resetFilters();
		localStorage.removeItem(STORAGE_KEY);
	}

	/**
	 * Resets store to initial state.
	 */
	reset() {
		this.state = { ...INITIAL_STATE, filters: { ...STAFF_DEFAULT_FILTERS } };
	}

	/**
	 * Returns true if any filter or search term deviates from defaults.
	 */
	get hasActiveFilters(): boolean {
		return this.filterCount > 0;
	}

	/**
	 * Returns the number of active filters including search term.
	 */
	get filterCount(): number {
		let count = 0;

		if (this.state.searchTerm.length > 0) count++;
		if (this.state.filters.role !== "all") count++;
		if (this.state.filters.status !== "all") count++;

		return count;
	}

	/**
	 * Builds URLSearchParams from current state, including only non-default values.
	 */
	get searchParams(): URLSearchParams {
		const params = new URLSearchParams();

		if (this.state.searchTerm) {
			params.set("search", this.state.searchTerm);
		}

		if (this.state.currentPage > 1) {
			params.set("page", this.state.currentPage.toString());
		}

		if (this.state.filters.role !== "all") {
			params.set("role", this.state.filters.role);
		}

		if (this.state.filters.status !== "all") {
			params.set("status", this.state.filters.status);
		}

		return params;
	}

	/**
	 * Loads search state from localStorage if saveSearch was enabled.
	 */
	private loadFromStorage() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				this.restoreFromStorage(parsed);
			}
		} catch (error) {
			logger.warn("Failed to load staff search state from localStorage", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Restores state from parsed storage data with type-guard validation.
	 */
	private restoreFromStorage = action((parsed: unknown) => {
		if (typeof parsed !== "object" || parsed === null) {
			return;
		}

		const data = parsed as Record<string, unknown>;

		// Only restore if saveSearch was enabled when stored
		if (data.saveSearch !== true) {
			return;
		}

		if (typeof data.searchTerm === "string") {
			this.state.searchTerm = data.searchTerm;
		}

		if (typeof data.filters === "object" && data.filters !== null) {
			const filters = data.filters as Record<string, unknown>;
			this.state.filters = {
				role:
					typeof filters.role === "string"
						? filters.role
						: STAFF_DEFAULT_FILTERS.role,
				status:
					typeof filters.status === "string"
						? filters.status
						: STAFF_DEFAULT_FILTERS.status,
			};
		}

		if (typeof data.currentPage === "number") {
			this.state.currentPage = data.currentPage;
		}

		if (typeof data.saveSearch === "boolean") {
			this.state.saveSearch = data.saveSearch;
		}
	});

	/**
	 * Persists current search state to localStorage if saveSearch is enabled.
	 * Removes stored data if saveSearch is disabled.
	 */
	private saveToStorage() {
		if (this.state.saveSearch) {
			try {
				const dataToStore = {
					searchTerm: this.state.searchTerm,
					filters: this.state.filters,
					currentPage: this.state.currentPage,
					saveSearch: this.state.saveSearch,
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
			} catch (error) {
				logger.warn("Failed to save staff search state to localStorage", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

export const staffSearchStore = new StaffSearchStore();
