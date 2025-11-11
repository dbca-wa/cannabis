import React, { useRef, useEffect, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { SubmissionFormStore } from "@/features/submissions/stores/submissionForm.store";
import { SubmissionFormStoreContext } from "@/features/submissions/hooks/useSubmissionFormStore";
import { logger } from "@/shared/services/logger.service";

interface SubmissionFormStoreProviderProps {
	children: ReactNode;
	initialData?: Partial<SubmissionFormStore["formData"]>;
	onFormChange?: (store: SubmissionFormStore) => void;
}

export const SubmissionFormStoreProvider: React.FC<SubmissionFormStoreProviderProps> =
	observer(({ children, initialData, onFormChange }) => {
		// Create store instance using ref to ensure it's only created once
		const storeRef = useRef<SubmissionFormStore | null>(null);

		if (!storeRef.current) {
			storeRef.current = new SubmissionFormStore();

			// Apply initial data if provided
			if (initialData) {
				Object.assign(storeRef.current.formData, initialData);
				logger.debug("Initial data applied to submission form store", {
					initialData,
				});
			}
		}

		const store = storeRef.current;

		// Set up form change callback
		useEffect(() => {
			if (onFormChange) {
				// Call immediately with current state
				onFormChange(store);

				// Note: For real-time updates, components should observe the store directly
				// This callback is mainly for initial setup or major state changes
			}
		}, [store, onFormChange]);

		// Cleanup on unmount
		useEffect(() => {
			return () => {
				if (storeRef.current) {
					storeRef.current.dispose();
					logger.debug("Submission form store disposed");
				}
			};
		}, []);

		return (
			<SubmissionFormStoreContext.Provider value={store}>
				{children}
			</SubmissionFormStoreContext.Provider>
		);
	});
