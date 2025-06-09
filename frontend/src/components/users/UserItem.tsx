import { Link } from "react-router";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/usersApi";
import { User } from "@/types";
import { roleToReadable } from "@/lib/utils";

// Pass the entire user object rather than destructuring props
const UserItem = ({ user }: { user: User }) => {
	const queryClient = useQueryClient();

	const deleteUserMutation = useMutation({
		mutationFn: usersApi.deleteUser,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
		},
	});

	const handleDeleteUser = () => {
		if (confirm("Are you sure you want to delete this user?")) {
			deleteUserMutation.mutate(user.id);
		}
	};

	return (
		<TableRow className="border border-slate-800 dark:border-slate-800 hover:bg-transparent dark:hover-transparent">
			<TableCell>{user.id}</TableCell>
			<TableCell>{user.username}</TableCell>
			<TableCell>{user.email}</TableCell>
			<TableCell>{roleToReadable(user.role)}</TableCell>
			<TableCell>{user.is_superuser ? "t" : "f"}</TableCell>
			<TableCell className="space-x-2">
				<Button variant="ghost" asChild>
					<Link to={`/users/${user.id}`}>View</Link>
				</Button>

				<Button
					variant="destructive"
					size="sm"
					onClick={handleDeleteUser}
					disabled={
						deleteUserMutation.isPending || user.is_superuser
						// ||
						// user.id === authStore?.user.id
					}
				>
					Delete
				</Button>
			</TableCell>
		</TableRow>
	);
};

export default UserItem;
