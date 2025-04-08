import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { PencilIcon } from "lucide-react";

interface UserEditButtonProps {
	userId: string | number;
}

const UserEditButton = ({ userId }: UserEditButtonProps) => {
	return (
		<Button className="mt-4" asChild>
			<Link to={`/users/${userId}/edit`}>
				<PencilIcon className="mr-2 h-4 w-4" />
				Edit User
			</Link>
		</Button>
	);
};

export default UserEditButton;
