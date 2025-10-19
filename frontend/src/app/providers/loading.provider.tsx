import {
	createContext,
	useContext,
	type ReactNode,
	useState,
	useCallback,
} from "react";

interface LoadingState {
	progress: number;
	message: string;
	isComplete: boolean;
}

interface LoadingContextType {
	loadingState: LoadingState;
	updateProgress: (progress: number, message?: string) => void;
	setComplete: () => void;
	reset: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
	const context = useContext(LoadingContext);
	if (!context) {
		throw new Error("useLoading must be used within LoadingProvider");
	}
	return context;
};

interface LoadingProviderProps {
	children: ReactNode;
}

export const LoadingProvider = ({ children }: LoadingProviderProps) => {
	const [loadingState, setLoadingState] = useState<LoadingState>({
		progress: 0,
		message: "Initialising...",
		isComplete: false,
	});

	const updateProgress = useCallback((progress: number, message?: string) => {
		setLoadingState((prev) => ({
			...prev,
			progress: Math.min(100, Math.max(0, progress)),
			message: message || prev.message,
		}));
	}, []);

	const setComplete = useCallback(() => {
		setLoadingState((prev) => ({
			...prev,
			progress: 100,
			isComplete: true,
			message: "Complete!",
		}));
	}, []);

	const reset = useCallback(() => {
		setLoadingState({
			progress: 0,
			message: "Initialising...",
			isComplete: false,
		});
	}, []);

	return (
		<LoadingContext.Provider
			value={{
				loadingState,
				updateProgress,
				setComplete,
				reset,
			}}
		>
			{children}
		</LoadingContext.Provider>
	);
};
