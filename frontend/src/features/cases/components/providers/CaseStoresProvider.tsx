import React, { type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { CaseFormStoreProvider } from "./CaseFormStoreProvider";
import type { CaseFormStore } from "@/features/cases/stores/caseForm.store";

interface CaseStoresProviderProps {
	children: ReactNode;
	initialData?: Partial<CaseFormStore["formData"]>;
	onFormChange?: (store: CaseFormStore) => void;
}

/**
 * Provides the CaseFormStore used by the case creation page and the OCR
 * prefill. Kept as the single provider the case pages mount, so further case
 * stores can be added here without touching the pages.
 */
export const CaseStoresProvider: React.FC<CaseStoresProviderProps> = observer(
	({ children, initialData, onFormChange }) => (
		<CaseFormStoreProvider
			initialData={initialData}
			onFormChange={onFormChange}
		>
			{children}
		</CaseFormStoreProvider>
	)
);
