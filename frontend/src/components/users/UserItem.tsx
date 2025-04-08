import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/rootStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/usersApi";
import { User } from "@/types";

// Pass the entire user object rather than destructuring props
const UserItem = observer(({ user }: { user: User }) => {
	const authStore = useAuthStore();
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
		<TableRow>
			<TableCell>{user.id}</TableCell>
			<TableCell>{user.username}</TableCell>
			<TableCell>{user.email}</TableCell>
			<TableCell className="space-x-2">
				<Button variant="ghost" asChild>
					<Link to={`/users/${user.id}`}>View</Link>
				</Button>

				{authStore.isAdmin && (
					<Button
						variant="destructive"
						size="sm"
						onClick={handleDeleteUser}
						disabled={deleteUserMutation.isPending}
					>
						Delete
					</Button>
				)}
			</TableCell>
		</TableRow>
	);
});

export default UserItem;
