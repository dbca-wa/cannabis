import { useLocation } from "react-router";
import { getSidebarItemFromRoute } from "@/app/config/routes.config";

/**
 * Hook that derives active sidebar item from current route
 * router is the source of truth
 */
export function useSidebarItem() {
	const location = useLocation();
	const activeSidebarItem = getSidebarItemFromRoute(location.pathname);

	return {
		activeSidebarItem,
		isActiveSidebarItem: (name: string) => activeSidebarItem === name,
	};
}
