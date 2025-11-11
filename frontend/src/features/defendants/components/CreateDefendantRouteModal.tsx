import { CreateDefendantModal } from "./CreateDefendantModal";

/**
 * Route-based modal wrapper for creating defendants.
 * Used when navigating to /defendants/add route.
 * Automatically navigates back to /defendants on close.
 */
export const CreateDefendantRouteModal = () => {
	return (
		<CreateDefendantModal
			open={true}
			onOpenChange={() => {}} // Handled by isRouteModal
			isRouteModal={true}
		/>
	);
};
