import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router";
import { type IUser } from "@/features/user/types/users.types";

interface UserProfileHeaderProps {
	user: IUser;
	canEdit: boolean;
}

const UserProfileHeader = ({ user, canEdit }: UserProfileHeaderProps) => {
	return (
		<div className="flex items-center justify-between mb-6">
			<div>
				<h1 className="text-3xl font-bold">{user.email}</h1>
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
};

export default UserProfileHeader;
