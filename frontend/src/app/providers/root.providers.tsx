import { type ReactNode, useState, useCallback } from "react";
import { HelmetProvider } from "react-helmet-async";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { StoreProvider, useUIStore } from "./store.provider";
import { QueryProvider } from "./query.provider";
import { Toaster } from "@/shared/components/ui/sonner";
import { ErrorBoundary } from "@/shared/components/feedback/ErrorBoundary";
import { observer } from "mobx-react";
import { LoadingProvider, useLoading } from "./loading.provider";
import { useAppInitialisation } from "@/shared/hooks";
import CookingCannabisLoader from "@/shared/components/feedback/CookingCannabisLoader";
import { CannabisLoader } from "@/shared/components/feedback/CannabisLoader";
import MinimalCannabisLoader from "@/shared/components/feedback/MinimalCannabisLoader";
import { cn } from "@/shared/utils";

interface RootProviderProps {
	children: ReactNode;
}

const LoadingOrchestrator = observer(({ children }: RootProviderProps) => {
	const { loadingState } = useLoading();
	const [showContent, setShowContent] = useState(false);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const uiStore = useUIStore();

	useAppInitialisation();

	// Handle completion
	const handleLoadingComplete = useCallback(() => {
		setIsTransitioning(true);
		setTimeout(() => setShowContent(true), 500);
	}, []);

	const getLoader = () => {
		const commonProps = {
			progress: loadingState.progress,
			message: loadingState.message,
			isComplete: loadingState.isComplete,
			onComplete: handleLoadingComplete,
		};

		switch (uiStore.currentLoader) {
			case "cook":
				return <CookingCannabisLoader {...commonProps} />;
			case "base":
				return <CannabisLoader {...commonProps} />;
			default:
				return <MinimalCannabisLoader {...commonProps} />;
		}
	};

	// Show loader until we're ready to transition
	if (!showContent) {
		return (
			<div className="flex h-screen w-screen items-center justify-center">
				<div
					className={`transition-opacity duration-1000 ${
						isTransitioning ? "opacity-0" : "opacity-100"
					}`}
				>
					{getLoader()}
				</div>
			</div>
		);
	}

	// Content is ready - fade in
	return (
		<div className="w-full h-full animate-in fade-in duration-1000">
			{children}
		</div>
	);
});

const AppContent = ({ children }: RootProviderProps) => {
	return (
		<div
			className={cn(
				"flex h-screen w-screen items-center justify-center transition-colors duration-200",
				// Theme-aware app container background
				"dark:bg-gray-900 bg-gray-50"
			)}
		>
			<ErrorBoundary>
				<HelmetProvider>
					<QueryProvider>
						<TooltipProvider>
							<LoadingOrchestrator>
								{children}
							</LoadingOrchestrator>
							<Toaster />
						</TooltipProvider>
					</QueryProvider>
				</HelmetProvider>
			</ErrorBoundary>
		</div>
	);
};

// Root provider - establishes the provider hierarchy
export const RootProvider = ({ children }: RootProviderProps) => {
	return (
		<StoreProvider>
			<LoadingProvider>
				<AppContent>{children}</AppContent>
			</LoadingProvider>
		</StoreProvider>
	);
};
