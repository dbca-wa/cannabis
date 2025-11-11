import { createContext, useContext } from "react";
import { SubmissionFormStore } from "@/features/submissions/stores/submissionForm.store";

// Create context for the submission form store
export const SubmissionFormStoreContext =
	createContext<SubmissionFormStore | null>(null);

// Hook to use the submission form store
export const useSubmissionFormStore = (): SubmissionFormStore => {
	const store = useContext(SubmissionFormStoreContext);

	if (!store) {
		throw new Error(
			"useSubmissionFormStore must be used within a SubmissionFormStoreProvider"
		);
	}

	return store;
};

// Hook to check if store is available (for optional usage)
export const useSubmissionFormStoreOptional =
	(): SubmissionFormStore | null => {
		return useContext(SubmissionFormStoreContext);
	};
