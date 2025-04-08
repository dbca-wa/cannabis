import { RootStore } from "./rootStore";
import { AuthStore } from "./authStore";
import { UIStore } from "./uiStore";

// Store reference for non-React contexts (like route guards)
let storeRef: RootStore | null = null;

// Set the store reference - this should be called from StoreInitializer
export const setStoreRefForUtils = (store: RootStore) => {
	storeRef = store;
};

// Create a temporary AuthStore for route guards to use before the real one is ready
const createTemporaryAuthStore = () => {
	const tempAuthStore = new AuthStore();

	// Initialize with token if available
	const token = localStorage.getItem("token");
	if (token) {
		// This is a minimal setup that allows route guards to work
		Object.assign(tempAuthStore, {
			token,
			isAuthenticated: !!token,
			isAdmin: false,
		});
	}

	return tempAuthStore;
};

// Get the auth store - used in router guards
export const getAuthStore = () => {
	// If we have the real store, use it
	if (storeRef) {
		return storeRef.authStore;
	}

	// Otherwise return a temporary auth store for the initial render
	// This avoids errors during initialization
	return createTemporaryAuthStore();
};

// Get the UI store if needed elsewhere outside React components
export const getUIStore = () => {
	if (!storeRef) {
		return new UIStore(); // Return a temporary UI store
	}
	return storeRef.uiStore;
};
