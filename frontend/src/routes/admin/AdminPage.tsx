import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useAuthStore, useUIStore } from "@/stores/rootStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminPage = observer(() => {
	const authStore = useAuthStore();
	const uiStore = useUIStore();

	// Set page metadata when the component mounts
	useEffect(() => {
		uiStore.setPageMetadata({
			title: "Admin Dashboard",
			description: "System administration and controls",
			breadcrumbs: [
				{ label: "Dashboard", path: "/" },
				{ label: "Admin" },
			],
		});
	}, [uiStore]);

	if (!authStore.isAdmin) {
		return (
			<Alert>
				<AlertDescription>
					You must be an admin to view this page.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Admin Controls</CardTitle>
				</CardHeader>
				<CardContent>
					<p>This content is only visible to administrators (you).</p>
				</CardContent>
			</Card>
		</div>
	);
});

export default AdminPage;
