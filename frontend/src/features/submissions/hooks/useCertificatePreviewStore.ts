import { createContext, useContext } from "react";
import { CertificatePreviewStore } from "@/features/submissions/stores/certificatePreview.store";

// Create context for the certificate preview store
export const CertificatePreviewStoreContext =
	createContext<CertificatePreviewStore | null>(null);

// Hook to use the certificate preview store
export const useCertificatePreviewStore = (): CertificatePreviewStore => {
	const store = useContext(CertificatePreviewStoreContext);

	if (!store) {
		throw new Error(
			"useCertificatePreviewStore must be used within a CertificatePreviewStoreProvider"
		);
	}

	return store;
};

// Hook to check if store is available (for optional usage)
export const useCertificatePreviewStoreOptional =
	(): CertificatePreviewStore | null => {
		return useContext(CertificatePreviewStoreContext);
	};
