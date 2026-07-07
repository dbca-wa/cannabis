import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { PageHeader } from "@/shared/components/PageHeader";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Navigate } from "react-router";
import SettingsContent from "@/features/admin/components/SettingsContent";

const Settings = () => {
	const { user } = useAuth();
	useDocumentTitle("Settings");

	const hasAccess = !!(
		user?.is_staff ||
		user?.is_superuser ||
		user?.role === "botanist" ||
		user?.role === "finance"
	);
	if (!hasAccess) {
		return <Navigate to="/" replace />;
	}

	return (
		<>
			<PageHeader title="Settings" subtitle="App-wide settings." />
			<SettingsContent />
		</>
	);
};

export default Settings;
