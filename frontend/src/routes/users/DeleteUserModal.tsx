import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalFooter,
} from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import { useUserById, useUsers } from "@/hooks/tanstack/useUsers";
import { AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const DeleteUserModal = () => {
	const navigate = useNavigate();
	const { userId } = useParams();

	const { user, isLoading } = useUserById(userId!);
	const { deleteUser, isDeleting } = useUsers();

	const handleClose = () => {
		navigate("/users");
	};

	const handleDelete = async () => {
		if (!userId) return;

		try {
			await deleteUser(userId);
			toast.success("User deleted successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to delete user");
			console.error("Delete error:", error);
		}
	};

	// Show loading spinner while fetching user data
	if (isLoading || !user) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<ResponsiveModalContent
					side={"bottom"}
					title="Delete User"
					description="Loading user information..."
				>
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	const getUserRoleDisplay = () => {
		if (user.police_data) {
			return `Police (${user.police_data.police_id || "No ID"})`;
		}
		if (user.role === "botanist") {
			return "Approved Botanist";
		}
		if (user.role === "finance") {
			return "Finance Officer";
		}
		return "No Role";
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Delete User"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					{/* Warning Icon and Message */}
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
						<div>
							<h4 className="font-semibold text-red-800">
								Are you sure you want to delete this user?
							</h4>
							<p className="text-sm text-red-600 mt-1">
								This action is permanent and cannot be undone.
								All user data and associated records will be
								removed.
							</p>
						</div>
					</div>

					{/* User Information */}
					<div className="bg-gray-50 p-4 rounded-lg">
						<h5 className="font-medium text-gray-900 mb-2">
							User Details:
						</h5>
						<div className="space-y-1 text-sm">
							<div>
								<span className="font-medium text-gray-700">
									Name:
								</span>{" "}
								<span>
									{user.first_name} {user.last_name}
								</span>
							</div>
							<div>
								<span className="font-medium text-gray-700">
									Username:
								</span>{" "}
								<span>{user.username}</span>
							</div>
							<div>
								<span className="font-medium text-gray-700">
									Email:
								</span>{" "}
								<span>{user.email}</span>
							</div>
							<div>
								<span className="font-medium text-gray-700">
									Role:
								</span>{" "}
								<span>{getUserRoleDisplay()}</span>
							</div>
							{user.police_data?.station && (
								<div>
									<span className="font-medium text-gray-700">
										Station:
									</span>{" "}
									<span>{user.police_data.station.name}</span>
								</div>
							)}
						</div>
					</div>

					{/* Additional Warnings for Special Cases */}
					{user.is_staff && (
						<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
							<p className="text-sm text-amber-800">
								⚠️ This is a staff member. Deleting this user
								may affect system operations.
							</p>
						</div>
					)}

					{user.police_data && (
						<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
							<p className="text-sm text-blue-800">
								📋 This user has police profile data. All
								associated submissions and records will also be
								affected.
							</p>
						</div>
					)}
				</div>

				<ResponsiveModalFooter>
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isDeleting}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleDelete}
						disabled={isDeleting}
					>
						{isDeleting ? "Deleting..." : "Delete User"}
					</Button>
				</ResponsiveModalFooter>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};

export default DeleteUserModal;
