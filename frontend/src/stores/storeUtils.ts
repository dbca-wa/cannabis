import { RootStore } from "./rootStore";
import { AuthStore } from "./authStore";
import { UIStore } from "./uiStore";
import { runInAction } from "mobx";
import { User } from "@/types";

// Store reference for non-React contexts (like route guards)
let storeRef: RootStore | null = null;

// Set the store reference - this should be called from StoreIntialiser
export const setStoreRefForUtils = (store: RootStore) => {
	storeRef = store;
};

// Create a temporary AuthStore for route guards to use before the real one is ready
const createTemporaryAuthStore = () => {
	const tempAuthStore = new AuthStore();

	// Init with token if available
	const token = localStorage.getItem("token");
	if (token) {
		// Only modify the properties that computed values depend on (prevent error for directly trying to assign computed val)
		runInAction(() => {
			tempAuthStore.token = token;
			tempAuthStore.user = {} as User; // Provide a minimal user object since isAuthenticated checks for user
		});
	}

	return tempAuthStore;
};

// Get the auth store - used in router guards
export const getAuthStore = () => {
	// use real store if available
	if (storeRef) {
		return storeRef.authStore;
	}

	// otherwise return a temporary auth store for the initial render
	// (This avoids errors during init)
	return createTemporaryAuthStore();
};

// Get the UI store if needed elsewhere outside React components
export const getUIStore = () => {
	if (!storeRef) {
		return new UIStore(); // Return a temporary UI store
	}
	return storeRef.uiStore;
};
