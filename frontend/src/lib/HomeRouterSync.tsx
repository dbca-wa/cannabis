import { useUIStore } from "@/stores/rootStore";
import { observer } from "mobx-react";
import { useEffect } from "react";
import { useLocation } from "react-router";

const HomeRouterSync = observer(() => {
	const uiStore = useUIStore();
	const location = useLocation();

	useEffect(() => {
		// Update the active sidebar item based on the current route
		uiStore.updateSidebarFromRoute(location.pathname);
	}, [location.pathname, uiStore]);

	// This is a utility component with no UI
	return null;
});

export default HomeRouterSync;
