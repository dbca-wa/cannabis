import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ThemeBridge from "./components/ThemeBridge";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";
import { StoreProvider } from "./stores/rootStore";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000, // 1 minute
			retry: 1,
		},
	},
});

const App = () => {
	return <RouterProvider router={router} />;
};

createRoot(document.getElementById("root")!).render(
	<StoreProvider>
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
	</StoreProvider>
);
