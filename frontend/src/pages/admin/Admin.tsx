import { useEffect } from "react";
import { Shield } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { securityService } from "@/features/admin/services/security.service";
import DevelopmentContent from "@/features/admin/components/DevelopmentContent";

const Admin = () => {
	const { user } = useAuth();

	useEffect(() => {
		const accessCheck = securityService.checkAdminAccess(user);
		if (!accessCheck.allowed) {
			securityService.logSecurityEvent("access_denied", {
				userId: user?.id,
				reason: accessCheck.reason,
				component: "AdminPage",
			});
		}
	}, [user]);

	// Access check
	const accessCheck = securityService.checkAdminAccess(user);
	if (!accessCheck.allowed) {
		return (
			<Alert variant="destructive">
				<Shield className="h-4 w-4" />
				<AlertDescription>
					{accessCheck.reason ||
						"You don't have permission to access admin settings."}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<>
			<PageHeader
				title="Testing"
				subtitle="Generate test documents and send test emails."
			/>
			<DevelopmentContent />
		</>
	);
};

export default Admin;
