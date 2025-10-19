import { createContext, useContext, type ReactNode } from "react";
import { type RootStore, rootStore } from "../stores/root.store";

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

// Convenience hooks for commonly used stores
export const useUIStore = () => useStore().uiStore;
