import { PasswordResetSuccess as PasswordResetSuccessComponent } from "@/features/auth/components/PasswordResetSuccess";
import { Head } from "@/shared/components/layout/Head";

const PasswordResetSuccess = () => {
	return (
		<>
			<Head title="Reset Success" />
			<PasswordResetSuccessComponent />
		</>
	);
};

export default PasswordResetSuccess;
