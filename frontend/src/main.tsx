import { StrictMode, useEffect, useState } from "react";
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
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";

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
	const [showLoading, setShowLoading] = useState(false);

	useEffect(() => {
		// Only show loading indicator if loading persists for more than 300ms
		let timeout: NodeJS.Timeout;
		if (authStore.loading) {
			timeout = setTimeout(() => {
				setShowLoading(true);
			}, 300);
		} else {
			setShowLoading(false);
		}

		return () => clearTimeout(timeout);
	}, [authStore.loading]);

	if (authStore.loading && showLoading) {
		return (
			<div className="loading-container">
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
				<HelmetProvider>
					<ThemeBridge>
						<QueryClientProvider client={queryClient}>
							<TooltipProvider>
								<App />
							</TooltipProvider>
							<Toaster />
						</QueryClientProvider>
					</ThemeBridge>
				</HelmetProvider>
			</StoreInitialiser>
		</StoreProvider>
	</StrictMode>
);
