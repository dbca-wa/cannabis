import { makeAutoObservable } from "mobx";

type UserKindFilterType = "All" | "Police" | "DBCA";

export class SearchFilterStore {
	userKindFilter: UserKindFilterType = "All";
	userKindFilterStorageKey: string = "userkind-filter";
	userSearchFilter: string = "";
	userSearchFilterStorageKey: string = "usersearch-filter";

	constructor() {
		makeAutoObservable(this);
		this.initFromStorage();
	}

	private initFromStorage = () => {
		try {
			const storedUserFilter = localStorage.getItem(
				this.userKindFilterStorageKey
			) as UserKindFilterType;
			if (
				storedUserFilter &&
				["All", "Police", "DBCA"].includes(storedUserFilter)
			) {
				this.userKindFilter = storedUserFilter;
			}
		} catch (error) {
			console.error(
				"Failed to initialize Search state from storage",
				error
			);
		}
	};

	setUserKindFilter = (filter: UserKindFilterType) => {
		this.userKindFilter = filter;
		try {
			localStorage.setItem(this.userKindFilterStorageKey, filter);
		} catch (error) {
			console.error("Failed to save user filter to storage", error);
		}
	};

	setUserSearchFilter = (searchString: string) => {
		this.userSearchFilter = searchString;
		try {
			localStorage.setItem(this.userSearchFilterStorageKey, searchString);
		} catch (error) {
			console.error(
				"Failed to save user search string to storage",
				error
			);
		}
	};
}
