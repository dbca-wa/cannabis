import { BaseStore, type BaseStoreState } from "@/app/stores/base.store";
import { logger } from "@/shared/services/logger.service";
import { runInAction } from "mobx";

interface AuthStoreState extends BaseStoreState {
	// Client-side auth state only
	redirectPath: string | null;
	isNavigating: boolean;
}

export class AuthStore extends BaseStore<AuthStoreState> {
	private navigate?: (
		path: string,
		options?: Record<string, unknown>
	) => void;

	constructor() {
		super({
			redirectPath: null,
			isNavigating: false,
			loading: false,
			error: null,
			initialised: true, // Client state is immediately available
		});
	}

	setNavigate(
		navigate: (path: string, options?: Record<string, unknown>) => void
	): void {
		this.navigate = navigate;
		logger.debug("Navigation handler set for auth store", undefined);
	}

	// Client-side navigation state
	get redirectPath(): string | null {
		return this.state.redirectPath;
	}

	get isNavigating(): boolean {
		return this.state.isNavigating;
	}

	// Client-side initialisation (no async operations needed)
	async initialise(): Promise<void> {
		logger.debug("AuthStore initialised (client state only)", undefined);
	}

	// Client-side navigation methods
	setRedirectPath(path: string | null): void {
		runInAction(() => {
			this.state.redirectPath = path;
		});
		logger.debug("Redirect path set", { path });
	}

	clearRedirectPath(): void {
		runInAction(() => {
			this.state.redirectPath = null;
		});
		logger.debug("Redirect path cleared", undefined);
	}

	// Client-side navigation after successful login
	navigateAfterLogin(): void {
		runInAction(() => {
			this.state.isNavigating = true;
		});

		const targetPath = this.state.redirectPath || "/";

		if (this.navigate) {
			this.navigate(targetPath, { replace: true });
			logger.info("Navigated after login", { targetPath });
		}

		runInAction(() => {
			this.state.redirectPath = null;
			this.state.isNavigating = false;
		});
	}

	// Client-side navigation after logout
	navigateAfterLogout(): void {
		runInAction(() => {
			this.state.isNavigating = true;
		});

		if (this.navigate) {
			this.navigate("/auth/login", { replace: true });
			logger.info("Navigated after logout", undefined);
		}

		runInAction(() => {
			this.state.redirectPath = null;
			this.state.isNavigating = false;
		});
	}

	// Handle unauthorised access (client-side navigation)
	handleUnauthorised(): void {
		logger.warn(
			"Handling unauthorised access - redirecting to login",
			undefined
		);

		// Store current path for redirect after login
		if (typeof window !== "undefined") {
			const currentPath = window.location.pathname;
			if (currentPath !== "/auth/login") {
				this.setRedirectPath(currentPath);
			}
		}

		this.navigateAfterLogout();
	}

	reset(): void {
		runInAction(() => {
			this.state.redirectPath = null;
			this.state.isNavigating = false;
			this.state.loading = false;
			this.state.error = null;
			this.state.initialised = true;
		});

		logger.info("Auth store reset", undefined);
	}

	async dispose(): Promise<void> {
		this.reset();
		logger.info("Auth store disposed", undefined);
	}
}
