import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { PageHeader } from "@/shared/components/PageHeader";
import SettingsContent from "@/features/admin/components/SettingsContent";

/**
 * The Settings page. Anyone signed in can open it; who may change what is
 * decided by SettingsContent (read-only for people without a role, and in
 * practice mode).
 */
const Settings = () => {
	useDocumentTitle("Settings");

	return (
		<>
			<PageHeader title="Settings" subtitle="App-wide settings." />
			<SettingsContent />
		</>
	);
};

export default Settings;
