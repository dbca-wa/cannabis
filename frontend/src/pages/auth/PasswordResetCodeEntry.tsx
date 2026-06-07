import { PasswordResetCodeEntry as PasswordResetCodeEntryComponent } from "@/features/auth/components/PasswordResetCodeEntry";
import { Head } from "@/shared/components/layout/Head";

const PasswordResetCodeEntry = () => {
	return (
		<>
			<Head title="Enter Code" />
			<PasswordResetCodeEntryComponent />
		</>
	);
};

export default PasswordResetCodeEntry;
