import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "@/types"; // Assuming you have a User type defined
import { DataDisplay } from "@/components/DataDisplay";
import { Separator } from "@/components/ui/separator";

interface UserDetailsProps {
	user: User;
}

const UserDetails = observer(({ user }: UserDetailsProps) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle>User Information</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<DataDisplay
						getData={() => user.username}
						renderLabel={() => "Username"}
					/>

					<DataDisplay
						getData={() => user.email}
						renderLabel={() => "Email"}
					/>

					<DataDisplay
						getData={() =>
							user.isAdmin ? "Administrator" : "Regular User"
						}
						renderLabel={() => "Role"}
					/>

					<DataDisplay
						getData={() =>
							user.createdAt
								? new Date(user.createdAt).toLocaleDateString()
								: "N/A"
						}
						renderLabel={() => "Account Created"}
					/>

					<DataDisplay
						getData={() =>
							user.lastLogin
								? new Date(user.lastLogin).toLocaleDateString()
								: "Never"
						}
						renderLabel={() => "Last Login"}
					/>
				</div>

				<Separator />

				<div>
					<h3 className="text-lg font-medium mb-2">User Activity</h3>
					{user.activities && user.activities.length > 0 ? (
						<ul className="space-y-2">
							{user.activities.map((activity, index) => (
								<li key={index} className="text-sm">
									{activity.action} -{" "}
									{new Date(
										activity.timestamp
									).toLocaleString()}
								</li>
							))}
						</ul>
					) : (
						<p className="text-gray-500">No activity recorded</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
});

export default UserDetails;
