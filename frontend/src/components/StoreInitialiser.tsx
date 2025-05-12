import { FC, useEffect } from "react";
import { useStore } from "@/stores/rootStore";
import { setStoreRef } from "@/api/axiosInstance";
import { setStoreRefForUtils } from "@/stores/storeUtils";

interface Props {
	children: React.ReactNode;
}

const StoreInitialiser: FC<Props> = ({ children }) => {
	const rootStore = useStore();

	useEffect(() => {
		// Set the store reference for axios when the component mounts
		setStoreRef(rootStore);

		// Set the store reference for router guards and other non-React contexts
		setStoreRefForUtils(rootStore);

		// Check authentication on initialization if a token exists
		// This ensures user data is fetched when the page is refreshed
		if (rootStore.authStore.token) {
			rootStore.authStore.checkAuth();
		}
	}, [rootStore]);

	return <>{children}</>;
};

export default StoreInitialiser;
