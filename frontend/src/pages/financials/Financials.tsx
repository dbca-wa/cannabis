import { PageHeader } from "@/shared/components/PageHeader";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Navigate } from "react-router";
import SettingsContent from "@/features/admin/components/SettingsContent";

const Financials = () => {
	const { user } = useAuth();

	// Access guard: staff or superuser only
	if (!user?.is_staff && !user?.is_superuser) {
		return <Navigate to="/" replace />;
	}

	return (
		<>
			<PageHeader
				title="Financials"
				subtitle="Cost settings and pricing configuration."
			/>
			<SettingsContent />
		</>
	);
};

export default Financials;
