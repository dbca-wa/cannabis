import { makeAutoObservable } from "mobx";

type Theme = "dark" | "light" | "system";

// Define page metadata interface
export interface PageMetadata {
	title: string;
	description?: string;
	breadcrumbs?: { label: string; path?: string }[];
	actions?: { label: string; handler: () => void; variant?: string }[];
}

export class UIStore {
	// Sidebar state
	sidebarOpen: boolean = true;
	// Theme state - compatible with Shadcn
	theme: Theme = "system";
	// Current active section/page
	activeSection: string = "home";
	// Page metadata for dynamic header content
	pageMetadata: PageMetadata = { title: "Dashboard" };
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

			// Get sidebar state from localStorage
			const storedSidebarOpen = localStorage.getItem("sidebarOpen");
			if (storedSidebarOpen !== null) {
				this.sidebarOpen = JSON.parse(storedSidebarOpen);
			}
		} catch (error) {
			console.error("Failed to initialize UI state from storage", error);
		}
	}

	toggleSidebar = () => {
		this.sidebarOpen = !this.sidebarOpen;
		localStorage.setItem("sidebarOpen", JSON.stringify(this.sidebarOpen));
	};

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

	// Set active section (for sidebar highlighting)
	setActiveSection = (section: string) => {
		this.activeSection = section;
	};

	// Update page metadata (for header content)
	setPageMetadata = (metadata: Partial<PageMetadata>) => {
		this.pageMetadata = { ...this.pageMetadata, ...metadata };
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

	// Set loading state for a specific UI element
	setLoading = (key: string, isLoading: boolean) => {
		this.loadingStates[key] = isLoading;
	};

	// Check if a specific UI element is loading
	isLoading = (key: string) => {
		return this.loadingStates[key] || false;
	};
}
