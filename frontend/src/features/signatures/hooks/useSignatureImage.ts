/**
 * Hook that fetches the signature image via the authenticated API
 * and returns a local blob URL for use in <img> tags.
 * Re-fetches automatically when the signature's updated_at changes.
 */

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/shared/services/api";
import { SIGNATURE_ENDPOINTS } from "../services/signatures.endpoints";

export const useSignatureImage = (
	hasSignature: boolean,
	updatedAt?: string
) => {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const prevUrlRef = useRef<string | null>(null);

	useEffect(() => {
		if (!hasSignature) {
			if (prevUrlRef.current) {
				URL.revokeObjectURL(prevUrlRef.current);
				prevUrlRef.current = null;
			}
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setBlobUrl(null);
			return;
		}

		let cancelled = false;
		setIsLoading(true);

		apiClient
			.get<Blob>(SIGNATURE_ENDPOINTS.ME_IMAGE, { responseType: "blob" })
			.then((blob) => {
				if (cancelled) return;
				if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
				const url = URL.createObjectURL(blob);
				prevUrlRef.current = url;
				setBlobUrl(url);
			})
			.catch(() => {
				if (!cancelled) setBlobUrl(null);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [hasSignature, updatedAt]);

	useEffect(() => {
		return () => {
			if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
		};
	}, []);

	return { blobUrl, isLoading };
};
