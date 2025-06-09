import { createContext, useContext, ReactNode } from "react";
import { AuthStore } from "./authStore";
import { UIStore } from "./uiStore";
import { SearchFilterStore } from "./searchFilterStore";

// Define the interface
export interface RootStoreType {
	authStore: AuthStore;
	uiStore: UIStore;
	searchFilterStore: SearchFilterStore;
}

export class RootStore implements RootStoreType {
	authStore: AuthStore;
	uiStore: UIStore;
	searchFilterStore: SearchFilterStore;

	constructor() {
		this.authStore = new AuthStore();
		this.uiStore = new UIStore();
		this.searchFilterStore = new SearchFilterStore();
	}
}

// Create singleton instance
const rootStore = new RootStore();

// Create the store context
const StoreContext = createContext<RootStore | null>(null);

// Provider props interface
interface StoreProviderProps {
	children: ReactNode;
}

// Provider component
export const StoreProvider = ({ children }: StoreProviderProps) => {
	return (
		<StoreContext.Provider value={rootStore}>
			{children}
		</StoreContext.Provider>
	);
};

// Custom hook to use the store
export const useStore = () => {
	const context = useContext(StoreContext);
	if (context === null) {
		throw new Error("useStore must be used within StoreProvider");
	}
	return context;
};

// Convenience hooks
export const useAuthStore = () => useStore().authStore;
export const useUIStore = () => useStore().uiStore;
export const useSearchFilterStore = () => useStore().searchFilterStore;

// Export singleton for direct access
export { rootStore };
