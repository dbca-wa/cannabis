import { NavigationProvider } from "@/app/providers/navigation.provider";
import { rootStore } from "@/app/stores/root.store";
import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { LoadingSpinner } from "../feedback/LoadingSpinner";
import { useEffect, useState } from "react";
import { cn } from "@/shared/utils";

const AuthLayout = observer(() => {
	const [isStoreInitialised, setIsStoreInitialised] = useState(false);
	const [initializationError, setInitializationError] = useState<string | null>(null);

	useEffect(() => {
		const initialiseStore = async () => {
			try {
				await rootStore.initialise();
				setIsStoreInitialised(true);
			} catch (error) {
				console.error("Store initialization failed:", error);
				setInitializationError("Failed to initialize application");
				// Still set as initialized to prevent infinite loading
				setIsStoreInitialised(true);
			}
		};

		initialiseStore();
	}, []);

	// Show loading only briefly while store is initialising
	if (!isStoreInitialised) {
		return (
			<NavigationProvider>
				<div
					className={cn(
						"flex h-screen w-screen items-center justify-center",
						""
					)}
				>
					<div className="flex flex-col items-center space-y-4">
						<LoadingSpinner />
						<p className="text-sm text-gray-600">
							Initializing...
						</p>
					</div>
				</div>
			</NavigationProvider>
		);
	}

	// Show error if initialization failed
	if (initializationError) {
		return (
			<NavigationProvider>
				<div
					className={cn(
						"flex h-screen w-screen items-center justify-center",
						"bg-white dark:bg-slate-900"
					)}
				>
					<div className="w-full max-w-md p-8 space-y-8 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white">
						<div className="text-center">
							<p className="text-red-600 mb-4">{initializationError}</p>
							<button
								onClick={() => window.location.reload()}
								className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
							>
								Reload Page
							</button>
						</div>
					</div>
				</div>
			</NavigationProvider>
		);
	}

	return (
		<NavigationProvider>
			<div
				className={cn(
					"flex h-screen w-screen items-center justify-center",
					"bg-white dark:bg-slate-900"
				)}
			>
				<div className="w-full max-w-md p-8 space-y-8 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white">
					<Outlet />
				</div>
			</div>
		</NavigationProvider>
	);
});

export default AuthLayout;
