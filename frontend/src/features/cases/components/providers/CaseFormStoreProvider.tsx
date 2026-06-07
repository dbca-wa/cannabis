import React, { useRef, useEffect, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { CaseFormStore } from "@/features/cases/stores/caseForm.store";
import { CaseFormStoreContext } from "@/features/cases/hooks/useCaseFormStore";
import { logger } from "@/shared/services/logger.service";

interface CaseFormStoreProviderProps {
	children: ReactNode;
	initialData?: Partial<CaseFormStore["formData"]>;
	onFormChange?: (store: CaseFormStore) => void;
}

export const CaseFormStoreProvider: React.FC<CaseFormStoreProviderProps> =
	observer(({ children, initialData, onFormChange }) => {
		// Create store instance using ref to ensure it's only created once
		const storeRef = useRef<CaseFormStore | null>(null);

		if (!storeRef.current) {
			storeRef.current = new CaseFormStore();

			// Apply initial data if provided
			if (initialData) {
				Object.assign(storeRef.current.formData, initialData);
				logger.debug("Initial data applied to case form store", {
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
					logger.debug("Case form store disposed");
				}
			};
		}, []);

		return (
			<CaseFormStoreContext.Provider value={store}>
				{children}
			</CaseFormStoreContext.Provider>
		);
	});
