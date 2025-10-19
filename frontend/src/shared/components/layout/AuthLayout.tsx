import { NavigationProvider } from "@/app/providers/navigation.provider";
import { rootStore } from "@/app/stores/root.store";
import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { LoadingSpinner } from "../feedback/LoadingSpinner";
import { useEffect, useState } from "react";
import { cn } from "@/shared/utils";

const AuthLayout = observer(() => {
	const [isStoreInitialised, setIsStoreInitialised] = useState(false);

	useEffect(() => {
		const initialiseStore = async () => {
			await rootStore.initialise();
			setIsStoreInitialised(true);
		};

		initialiseStore();
	}, []);

	// how loading while store is initialising
	if (!isStoreInitialised || !rootStore.authStore.isInitialised) {
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
							Checking authentication...
						</p>
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
