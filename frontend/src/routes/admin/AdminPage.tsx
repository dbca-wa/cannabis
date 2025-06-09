import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminPage = () => {
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
};

export default AdminPage;
