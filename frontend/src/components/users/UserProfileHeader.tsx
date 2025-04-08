import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import { User } from "@/types";

interface UserProfileHeaderProps {
	user: User;
	canEdit: boolean;
}

const UserProfileHeader = observer(
	({ user, canEdit }: UserProfileHeaderProps) => {
		return (
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-3xl font-bold">{user.username}</h1>
					<p className="text-gray-500">{user.email}</p>
				</div>

				<div className="space-x-2">
					<Button variant="ghost" asChild>
						<Link to="/users">Back to Users</Link>
					</Button>

					{canEdit && (
						<Button asChild>
							<Link to={`/users/${user.id}/edit`}>Edit User</Link>
						</Button>
					)}
				</div>
			</div>
		);
	}
);

export default UserProfileHeader;
