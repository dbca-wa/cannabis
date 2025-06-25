// src/App.tsx
import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { router } from "./router";
import ThemeBridge from "./components/ThemeBridge";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
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
	return (
		<StoreProvider>
			<HelmetProvider>
				<ThemeBridge>
					<QueryClientProvider client={queryClient}>
						<TooltipProvider>
							<RouterProvider router={router} />
						</TooltipProvider>
						<Toaster />
					</QueryClientProvider>
				</ThemeBridge>
			</HelmetProvider>
		</StoreProvider>
	);
};

export default App;
