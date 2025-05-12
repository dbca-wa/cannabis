import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/rootStore";
import { observer } from "mobx-react-lite";

const AdminPage = observer(() => {
	const authStore = useAuthStore();

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
