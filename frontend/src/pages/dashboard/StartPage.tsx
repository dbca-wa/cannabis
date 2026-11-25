import { Navigate } from "react-router";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { AwaitingRoleNotice } from "@/features/dash/components/AwaitingRoleNotice";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/**
 * The start page ("/") while the dashboard is switched off: people with a
 * role go straight to Cases, and anyone still waiting for a role sees the
 * notice that explains why they cannot use the app yet.
 */
const StartPage = () => {
	const { hasAppAccess } = useAuth();
	useDocumentTitle("Cannabis");
	if (!hasAppAccess) return <AwaitingRoleNotice />;
	return <Navigate to="/cases" replace />;
};

export default StartPage;
