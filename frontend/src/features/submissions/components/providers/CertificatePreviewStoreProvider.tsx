import React, { useRef, useEffect, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { CertificatePreviewStore } from "@/features/submissions/stores/certificatePreview.store";
import { CertificatePreviewStoreContext } from "@/features/submissions/hooks/useCertificatePreviewStore";
import { logger } from "@/shared/services/logger.service";

interface CertificatePreviewStoreProviderProps {
	children: ReactNode;
	autoRefresh?: boolean;
	template?: "standard" | "detailed" | "summary";
}

export const CertificatePreviewStoreProvider: React.FC<CertificatePreviewStoreProviderProps> =
	observer(({ children, autoRefresh = true, template = "standard" }) => {
		// Create store instance using ref to ensure it's only created once
		const storeRef = useRef<CertificatePreviewStore | null>(null);

		if (!storeRef.current) {
			storeRef.current = new CertificatePreviewStore();

			// Apply initial settings
			storeRef.current.setAutoRefresh(autoRefresh);
			storeRef.current.setTemplate(template);

			logger.debug("Certificate preview store created", {
				autoRefresh,
				template,
			});
		}

		const store = storeRef.current;

		// Update settings when props change
		useEffect(() => {
			store.setAutoRefresh(autoRefresh);
		}, [store, autoRefresh]);

		useEffect(() => {
			store.setTemplate(template);
		}, [store, template]);

		// Cleanup on unmount
		useEffect(() => {
			return () => {
				if (storeRef.current) {
					storeRef.current.dispose();
					logger.debug("Certificate preview store disposed");
				}
			};
		}, []);

		return (
			<CertificatePreviewStoreContext.Provider value={store}>
				{children}
			</CertificatePreviewStoreContext.Provider>
		);
	});
