import { createContext, useContext, ReactNode } from "react";
import { AuthStore } from "./authStore";
import { UIStore } from "./uiStore";
import { RootStoreType } from "@/types";

export class RootStore implements RootStoreType {
	authStore: AuthStore;
	uiStore: UIStore;

	constructor() {
		this.authStore = new AuthStore();
		this.uiStore = new UIStore();
	}
}

// Create the store context
const StoreContext = createContext<RootStore | null>(null);

// Create a provider component
interface StoreProviderProps {
	children: ReactNode;
}

export const StoreProvider = ({ children }: StoreProviderProps) => {
	const root = new RootStore();
	return (
		<StoreContext.Provider value={root}>{children}</StoreContext.Provider>
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
