import { useLoading } from "@/app/providers/loading.provider";
import { rootStore } from "@/app/stores/root.store";

import { useEffect } from "react";

// Loading stages configuration - separate from UI
const INITIALIZATION_STAGES = [
	{ progress: 10, message: "Starting authentication...", check: () => true },
	{
		progress: 30,
		message: "User authenticated ✓",
		check: () => rootStore.authStore?.isInitialised,
	},
	{
		progress: 50,
		message: "Loading UI preferences...",
		check: () => rootStore.uiStore?.isInitialised,
	},

	{
		progress: 90,
		message: "Setting up workspace...",
		check: () => rootStore.isInitialised,
	},
	{
		progress: 100,
		message: "Ready!",
		check: () => rootStore.isInitialised,
	},
];

export const useAppInitialisation = () => {
	const { updateProgress, setComplete } = useLoading();

	useEffect(() => {
		// Removed performance monitoring and cache warming services

		let currentStageIndex = 0;

		const checkProgress = () => {
			// Find the highest stage we've completed
			let completedStageIndex = -1;

			for (let i = 0; i < INITIALIZATION_STAGES.length; i++) {
				if (INITIALIZATION_STAGES[i].check()) {
					completedStageIndex = i;
				} else {
					break;
				}
			}

			// Update to the next stage if we've progressed
			if (
				completedStageIndex >= currentStageIndex &&
				currentStageIndex < INITIALIZATION_STAGES.length
			) {
				const stage = INITIALIZATION_STAGES[currentStageIndex];
				updateProgress(stage.progress, stage.message);

				if (currentStageIndex === INITIALIZATION_STAGES.length - 1) {
					setComplete();
				} else {
					currentStageIndex++;
				}
			}
		};

		// Check progress periodically
		const interval = setInterval(checkProgress, 200);
		checkProgress(); // Initial check

		return () => {
			clearInterval(interval);
		};
	}, [updateProgress, setComplete]);
};
