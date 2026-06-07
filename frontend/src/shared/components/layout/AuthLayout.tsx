import { NavigationProvider } from "@/app/providers/navigation.provider";
import { rootStore } from "@/app/stores/root.store";
import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { LoadingSpinner } from "../feedback/LoadingSpinner";
import { useEffect, useState } from "react";
import { cn } from "@/shared/utils";

const AuthLayout = observer(() => {
	const [isStoreInitialised, setIsStoreInitialised] = useState(false);
	const [initializationError, setInitializationError] = useState<string | null>(
		null
	);

	useEffect(() => {
		const initialiseStore = async () => {
			try {
				await rootStore.initialise();
				setIsStoreInitialised(true);
			} catch (error) {
				console.error("Store initialisation failed:", error);
				setInitializationError("Failed to initialise application");
				// Still set as initialised to prevent infinite loading
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
						"bg-[#fafbfb] dark:bg-background"
					)}
				>
					<div className="flex flex-col items-center space-y-4">
						<LoadingSpinner />
						<p className="text-sm text-muted-foreground">Initialising...</p>
					</div>
				</div>
			</NavigationProvider>
		);
	}

	// Show error if initialisation failed
	if (initializationError) {
		return (
			<NavigationProvider>
				<div
					className={cn(
						"flex h-screen w-screen items-center justify-center",
						"bg-[#fafbfb] dark:bg-background"
					)}
				>
					<div className="w-full max-w-md p-8 space-y-8 rounded-xl bg-card dark:bg-card border border-border shadow-lg">
						<div className="text-center">
							<p className="text-destructive mb-4">{initializationError}</p>
							<button
								onClick={() => window.location.reload()}
								className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
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
					"bg-[#fafbfb] dark:bg-background"
				)}
			>
				<div className="w-full max-w-md p-8 space-y-8 rounded-xl bg-card dark:bg-card border border-border shadow-lg">
					<Outlet />
				</div>
			</div>
		</NavigationProvider>
	);
});

export default AuthLayout;
