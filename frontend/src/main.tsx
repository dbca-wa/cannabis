import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { observer } from "mobx-react";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoreProvider, useAuthStore } from "./stores/rootStore";
import { Spinner } from "./components/ui/custom/Spinner";
import ThemeBridge from "./components/ThemeBridge";
import StoreInitialiser from "./components/StoreInitialiser";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000, // 1 minute
			retry: 1,
		},
	},
});

const App = observer(() => {
	const authStore = useAuthStore();
	useEffect(() => {
		// Check authentication on app start
		authStore.checkAuth();
	}, [authStore]);

	if (authStore.loading) {
		return (
			<div className="h-full w-full flex items-center justify-center">
				<Spinner size={"large"} />
			</div>
		);
	}

	return <RouterProvider router={router} />;
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<StoreProvider>
			<StoreInitialiser>
				<ThemeBridge>
					<QueryClientProvider client={queryClient}>
						<App />
					</QueryClientProvider>
				</ThemeBridge>
			</StoreInitialiser>
		</StoreProvider>
	</StrictMode>
);
