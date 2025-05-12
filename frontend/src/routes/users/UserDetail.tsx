import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import UserDetails from "@/components/users/UserDetails";
import UserEditButton from "@/components/users/UserEditButton";
import UserProfileHeader from "@/components/users/UserProfileHeader";
import { useUserById } from "@/hooks/tanstack/useUsers";
import { useAuthStore } from "@/stores/rootStore";
import { observer } from "mobx-react-lite";
import { useParams } from "react-router";

const UserDetailPage = observer(() => {
	const { id } = useParams<{ id: string }>();
	const authStore = useAuthStore();

	const { data: user, isLoading, error } = useUserById(id as string);

	// Use MobX for UI permissions
	const canEdit = authStore.isAdmin || authStore.user?.id === Number(id);

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-12 w-3/4" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					Error loading user data. Please try again later.
				</AlertDescription>
			</Alert>
		);
	}

	if (!user) {
		return (
			<Alert>
				<AlertDescription>User not found.</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			<UserProfileHeader user={user} canEdit={canEdit} />
			<UserDetails user={user} />
			{canEdit && <UserEditButton userId={user.id} />}
		</div>
	);
});

export default UserDetailPage;
