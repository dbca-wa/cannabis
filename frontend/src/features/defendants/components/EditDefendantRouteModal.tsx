import { useNavigate, useParams } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/shared/components/ui/dialog";
import { DeleteRecordFooter } from "@/shared/components/DeleteRecordFooter";
import { EditDefendantForm } from "./forms";
import {
	useDefendantById,
	useDefendantUsage,
	useUpdateDefendant,
} from "../hooks/useDefendants";
import type { EditDefendantFormData } from "../schemas/defendantSchemas";
import { RelatedRecordLinks } from "@/shared/components/RelatedRecordLinks";

export const EditDefendantRouteModal = () => {
	const navigate = useNavigate();
	const { defendantId } = useParams<{ defendantId: string }>();
	const updateDefendant = useUpdateDefendant();

	const defendantIdNum = defendantId ? parseInt(defendantId, 10) : null;
	const { data: defendant, isLoading } = useDefendantById(defendantIdNum);
	// The cases that name this defendant, for the "View cases" count.
	const usage = useDefendantUsage(defendantIdNum);

	const handleClose = () => {
		navigate("/defendants");
	};

	const handleSubmit = async (data: EditDefendantFormData) => {
		if (!defendantIdNum) return;

		// Errors reach the form, which shows each message beside its field;
		// the mutation also shows a toast and the modal stays open.
		// Transform form data for API
		const apiData = {
			given_names: data.given_names || null,
			last_name: data.last_name,
		};

		await updateDefendant.mutateAsync({
			id: defendantIdNum,
			data: apiData,
		});
		handleClose();
	};

	if (isLoading) {
		return (
			<Dialog open={true} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Edit Defendant</DialogTitle>
						<DialogDescription>Loading defendant...</DialogDescription>
					</DialogHeader>
					<div className="p-6">
						<div className="animate-pulse space-y-4">
							<div className="h-4 bg-gray-200 rounded w-1/4"></div>
							<div className="h-10 bg-gray-200 rounded"></div>
							<div className="h-4 bg-gray-200 rounded w-1/4"></div>
							<div className="h-10 bg-gray-200 rounded"></div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (!defendant) {
		return (
			<Dialog open={true} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Defendant Not Found</DialogTitle>
						<DialogDescription>
							The requested defendant could not be found.
						</DialogDescription>
					</DialogHeader>
					<div className="p-6">
						<p className="text-muted-foreground">
							The defendant you're trying to edit doesn't exist or has been
							deleted.
						</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={true} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Defendant</DialogTitle>
					<DialogDescription>
						Update defendant information. Last name is required, given names is
						optional.
					</DialogDescription>
				</DialogHeader>
				<EditDefendantForm
					defendant={defendant}
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={updateDefendant.isPending}
				/>
				<RelatedRecordLinks
					links={[
						{
							noun: "cases",
							count: usage.data?.cases.length,
							to: `/cases?defendant=${defendant.id}`,
						},
					]}
				/>
				<DeleteRecordFooter
					noun="defendant"
					onDelete={() => navigate(`/defendants/${defendant.id}/delete`)}
					disabled={updateDefendant.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
};
