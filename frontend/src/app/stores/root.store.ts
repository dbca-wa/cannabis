import { apiClient } from "@/shared/services/api";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils";
import { makeObservable, observable } from "mobx";
import { AuthStore } from "./auth.store";
import { UIStore } from "./ui.store";

export class RootStore {
	authStore: AuthStore;
	uiStore: UIStore;

	// System state
	isInitialised = false;
	isShuttingDown = false;
	private initialisationPromise: Promise<void> | null = null;

	constructor() {
		this.authStore = new AuthStore();
		this.uiStore = new UIStore();

		// isInitialised observable
		makeObservable(this, {
			isInitialised: observable,
		});

		// set up logger access to stores
		this.setupLogger();
		this.setupApiClient();
		this.setupEventListeners();
	}

	private setupLogger() {
		logger.info("Logger configured");
	}

	private setupApiClient() {
		apiClient.setUnauthorizedHandler(() => this.handleUnauthorized());
		logger.info("API client configured with unauthorized handler");
	}

	private setupEventListeners() {
		if (typeof window !== "undefined") {
			window.addEventListener("beforeunload", this.handleBeforeUnload);
		}
	}

	async initialise(): Promise<void> {
		if (this.initialisationPromise) {
			return this.initialisationPromise;
		}

		this.initialisationPromise = this._initialise();
		return this.initialisationPromise;
	}

	private async _initialise(): Promise<void> {
		if (this.isInitialised) {
			return;
		}

		logger.info("Initialising application stores...", undefined);

		try {
			// Initialize stores in parallel for better performance
			await Promise.all([
				this.authStore.initialise(),
				this.uiStore.initialise?.() || Promise.resolve(),
			]);

			this.isInitialised = true;
			logger.info(
				"Application stores initialised successfully",
				undefined
			);
		} catch (error: unknown) {
			logger.error("Failed to initialise critical stores", {
				error: getErrorMessage(error),
			});
			throw error;
		}
	}

	async handleUnauthorized(): Promise<void> {
		logger.warn("Handling unauthorized access", undefined);

		try {
			// Use AuthStore's client-side navigation method
			this.authStore.handleUnauthorised();
		} catch (error) {
			logger.error("Error during unauthorized handling", {
				error: getErrorMessage(error),
			});
		}
	}

	private handleBeforeUnload = () => {
		this.dispose();
	};

	setNavigate(
		navigate: (path: string, options?: Record<string, unknown>) => void
	): void {
		this.authStore.setNavigate(navigate);
	}

	async dispose() {
		if (this.isShuttingDown) return;

		this.isShuttingDown = true;
		logger.info("Shutting down application stores...", undefined);

		try {
			// Cleanup event listeners
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"beforeunload",
					this.handleBeforeUnload
				);
			}

			// Graceful shutdown of stores
			await Promise.all([
				this.authStore.dispose?.(),
				this.uiStore.dispose?.(),
			]);

			this.isInitialised = false;
			this.initialisationPromise = null;

			logger.info("Application stores shutdown complete", undefined);
		} catch (error) {
			logger.error("Error during application shutdown", {
				error: getErrorMessage(error),
			});
		}
	}
}

// Create and export singleton instance
export const rootStore = new RootStore();
