import { makeAutoObservable } from "mobx";

type UserFilterType = "All" | "Police" | "DBCA";

export class SearchFilterStore {
	userFilter: UserFilterType = "All";
	userFilterStorageKey: string = "user-filter";

	constructor() {
		makeAutoObservable(this);
		this.initFromStorage();
	}

	private initFromStorage = () => {
		try {
			const storedUserFilter = localStorage.getItem(
				this.userFilterStorageKey
			) as UserFilterType;
			if (storedUserFilter) {
				this.userFilter = storedUserFilter;
			}
		} catch (error) {
			console.error(
				"Failed to initialize Search state from storage",
				error
			);
		}
	};
}
