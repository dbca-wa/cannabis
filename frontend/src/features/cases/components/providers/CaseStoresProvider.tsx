import React, { type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { CaseFormStoreProvider } from "./CaseFormStoreProvider";
import { CertificatePreviewStoreProvider } from "./CertificatePreviewStoreProvider";
import type { CaseFormStore } from "@/features/cases/stores/caseForm.store";

interface CaseStoresProviderProps {
	children: ReactNode;
	// Form store props
	initialData?: Partial<CaseFormStore["formData"]>;
	onFormChange?: (store: CaseFormStore) => void;
	// Preview store props
	autoRefresh?: boolean;
	template?: "standard" | "detailed" | "summary";
}

/**
 * Combined provider that provides both CaseFormStore and CertificatePreviewStore
 * This is the recommended provider for case forms that need both stores
 */
export const CaseStoresProvider: React.FC<CaseStoresProviderProps> = observer(
	({
		children,
		initialData,
		onFormChange,
		autoRefresh = true,
		template = "standard",
	}) => {
		return (
			<CaseFormStoreProvider
				initialData={initialData}
				onFormChange={onFormChange}
			>
				<CertificatePreviewStoreProvider
					autoRefresh={autoRefresh}
					template={template}
				>
					{children}
				</CertificatePreviewStoreProvider>
			</CaseFormStoreProvider>
		);
	}
);
