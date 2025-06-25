import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalFooter,
} from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import {
	useOrganisations,
	usePoliceStationById,
} from "@/hooks/tanstack/useOrganisations";
import { AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const DeleteOrganisationModal = () => {
	const navigate = useNavigate();
	const { organisationId } = useParams();

	const { station, isLoading } = usePoliceStationById(organisationId!);
	const { deleteStation, isDeleting } = useOrganisations();

	const handleClose = () => {
		navigate("/organisations");
	};

	const handleDelete = async () => {
		if (!organisationId) return;

		try {
			await deleteStation(organisationId);
			toast.success("Organisation deleted successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to delete organisation");
			console.error("Delete error:", error);
		}
	};

	// Show loading spinner while fetching station data
	if (isLoading || !station) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<ResponsiveModalContent
					side={"bottom"}
					title="Delete Organisation"
					description="Loading organisation information..."
				>
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Delete Organisation"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					{/* Warning Icon and Message */}
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
						<div>
							<h4 className="font-semibold text-red-800">
								Are you sure you want to delete this
								organisation?
							</h4>
							<p className="text-sm text-red-600 mt-1">
								This action is permanent and cannot be undone.
								All associated users and records will be
								affected.
							</p>
						</div>
					</div>

					{/* Organisation Information */}
					<div className="bg-gray-50 p-4 rounded-lg">
						<h5 className="font-medium text-gray-900 mb-2">
							Organisation Details:
						</h5>
						<div className="space-y-1 text-sm">
							<div>
								<span className="font-medium text-gray-700">
									Name:
								</span>{" "}
								<span>{station.name}</span>
							</div>
							{station.address && (
								<div>
									<span className="font-medium text-gray-700">
										Address:
									</span>{" "}
									<span>{station.address}</span>
								</div>
							)}
							{station.phone_number && (
								<div>
									<span className="font-medium text-gray-700">
										Phone:
									</span>{" "}
									<span>{station.phone_number}</span>
								</div>
							)}
							{station.email && (
								<div>
									<span className="font-medium text-gray-700">
										Email:
									</span>{" "}
									<span>{station.email}</span>
								</div>
							)}
							{station.created_at && (
								<div>
									<span className="font-medium text-gray-700">
										Created:
									</span>{" "}
									<span>
										{new Date(
											station.created_at
										).toLocaleDateString()}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Warning about affected users */}
					<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<p className="text-sm text-amber-800">
							⚠️ Deleting this organisation will affect all police
							officers assigned to this station. Their station
							membership will be removed.
						</p>
					</div>
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
						{isDeleting ? "Deleting..." : "Delete Organisation"}
					</Button>
				</ResponsiveModalFooter>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};

export default DeleteOrganisationModal;
