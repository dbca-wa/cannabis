import React, { type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { SubmissionFormStoreProvider } from "./SubmissionFormStoreProvider";
import { CertificatePreviewStoreProvider } from "./CertificatePreviewStoreProvider";
import type { SubmissionFormStore } from "@/features/submissions/stores/submissionForm.store";

interface SubmissionStoresProviderProps {
	children: ReactNode;
	// Form store props
	initialData?: Partial<SubmissionFormStore["formData"]>;
	onFormChange?: (store: SubmissionFormStore) => void;
	// Preview store props
	autoRefresh?: boolean;
	template?: "standard" | "detailed" | "summary";
}

/**
 * Combined provider that provides both SubmissionFormStore and CertificatePreviewStore
 * This is the recommended provider for submission forms that need both stores
 */
export const SubmissionStoresProvider: React.FC<SubmissionStoresProviderProps> =
	observer(
		({
			children,
			initialData,
			onFormChange,
			autoRefresh = true,
			template = "standard",
		}) => {
			return (
				<SubmissionFormStoreProvider
					initialData={initialData}
					onFormChange={onFormChange}
				>
					<CertificatePreviewStoreProvider
						autoRefresh={autoRefresh}
						template={template}
					>
						{children}
					</CertificatePreviewStoreProvider>
				</SubmissionFormStoreProvider>
			);
		}
	);
