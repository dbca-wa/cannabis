/**
 * Change Password page rendered within the standard app layout.
 * Reuses the existing PasswordUpdate form component.
 */

import { PageHeader } from "@/shared/components/PageHeader";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import PasswordUpdate from "./PasswordUpdate";

const ChangePassword = () => {
	useDocumentTitle("Change Password");

	return (
		<>
			<PageHeader
				title="Change Password"
				subtitle="Update your account password."
			/>
			<div className="flex justify-center">
				<PasswordUpdate />
			</div>
		</>
	);
};

export default ChangePassword;
