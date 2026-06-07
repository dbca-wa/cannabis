import { createContext, useContext } from "react";
import { CaseFormStore } from "@/features/cases/stores/caseForm.store";

// Create context for the case form store
export const CaseFormStoreContext = createContext<CaseFormStore | null>(null);

// Hook to use the case form store
export const useCaseFormStore = (): CaseFormStore => {
	const store = useContext(CaseFormStoreContext);

	if (!store) {
		throw new Error(
			"useCaseFormStore must be used within a CaseFormStoreProvider"
		);
	}

	return store;
};

// Hook to check if store is available (for optional usage)
export const useCaseFormStoreOptional = (): CaseFormStore | null => {
	return useContext(CaseFormStoreContext);
};
