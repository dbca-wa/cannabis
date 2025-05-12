import { makeAutoObservable } from "mobx";

type Theme = "dark" | "light" | "system";

const ROUTE_TO_HOME_SIDEBAR_MAP: Record<string, string> = {
	"/": "Home",
	"/users": "Users",
	"/submissions": "Submissions",
	"/admin": "Admin",
};

// Define page metadata interface
export interface PageMetadata {
	title: string;
	description?: string;
	breadcrumbs?: { label: string; path?: string }[];
	actions?: { label: string; handler: () => void; variant?: string }[];
}

export class UIStore {
	theme: Theme = "light";
	homeRouterMap: Record<string, string> = ROUTE_TO_HOME_SIDEBAR_MAP;
	activeSidebarItem: string = "Home";
	// Loading states for UI elements
	loadingStates: Record<string, boolean> = {};

	private storageKey: string = "cannabis-theme";

	constructor() {
		makeAutoObservable(this);

		// Initialize from localStorage if available
		this.initFromStorage();
	}

	private initFromStorage() {
		try {
			// Get theme from localStorage
			const storedTheme = localStorage.getItem(this.storageKey) as Theme;
			if (storedTheme) {
				this.theme = storedTheme;
			}
		} catch (error) {
			console.error("Failed to initialize UI state from storage", error);
		}
	}

	setTheme = (newTheme: Theme) => {
		this.theme = newTheme;
		localStorage.setItem(this.storageKey, newTheme);
		this.applyTheme();
	};

	applyTheme = () => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		if (this.theme === "system") {
			const systemTheme = window.matchMedia(
				"(prefers-color-scheme: dark)"
			).matches
				? "dark"
				: "light";

			root.classList.add(systemTheme);
			return;
		}

		root.classList.add(this.theme);
	};

	// Home sidebarmenu
	setActiveSidebarItem = (name: string) => {
		if (this.activeSidebarItem === name) {
			// Do nothing, there must always be one selected
			return;
		} else {
			this.activeSidebarItem = name;
		}
		// console.log(this.activeHomeSidebarItem);
	};

	updateSidebarFromRoute = (pathname: string) => {
		// Check for exact matches first
		if (ROUTE_TO_HOME_SIDEBAR_MAP[pathname]) {
			this.setActiveSidebarItem(ROUTE_TO_HOME_SIDEBAR_MAP[pathname]);
			return;
		}

		// Handle nested routes by finding the closest parent route
		const matchingRoute = Object.keys(ROUTE_TO_HOME_SIDEBAR_MAP)
			.filter((route) => route !== "/") // Skip root route for nested route checking
			.find((route) => pathname.startsWith(route));

		if (matchingRoute) {
			this.setActiveSidebarItem(ROUTE_TO_HOME_SIDEBAR_MAP[matchingRoute]);
		} else {
			// Default to Home if no match is found
			this.setActiveSidebarItem("Home");
		}
	};

	// Check if a specific home sidebar item is active
	isActiveSidebarItem = (name: string) => {
		return this.activeSidebarItem === name;
	};

	// Check if a path is active or is a parent of the active path
	isActiveOrChildPath = (path: string, currentPath: string) => {
		if (path === "/") {
			return currentPath === "/";
		}
		return (
			currentPath === path ||
			(path !== "/" && currentPath.startsWith(path))
		);
	};

	// Get the inverse mapping (sidebar item to route)
	getRouteForHomeSidebarItem = (sidebarItem: string): string => {
		// Find the route that maps to this sidebar item
		const entry = Object.entries(this.homeRouterMap).find(
			([_, item]) => item === sidebarItem
		);

		// Return the route or default to home
		return entry ? entry[0] : "/";
	};

	// Set loading state for a specific UI element
	setLoading = (key: string, isLoading: boolean) => {
		this.loadingStates[key] = isLoading;
	};

	// Check if a specific UI element is loading
	isLoading = (key: string) => {
		return this.loadingStates[key] || false;
	};
}
