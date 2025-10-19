import { useNavigate } from "react-router";
import { useEffect, type ReactNode } from "react";
import { rootStore } from "@/app/stores/root.store";
import { logger } from "@/shared/services/logger.service";

interface NavigationProviderProps {
	children: ReactNode;
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
	const navigate = useNavigate();

	useEffect(() => {
		// Give stores access to navigation
		rootStore.setNavigate(navigate);
		logger.debug("Navigation provider initialised", {
			hasNavigate: !!navigate,
		});
	}, [navigate]);

	return <>{children}</>;
};
