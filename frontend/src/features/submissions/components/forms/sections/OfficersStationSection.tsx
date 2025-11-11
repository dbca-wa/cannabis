import { observer } from "mobx-react-lite";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { useSubmissionFormStore } from "../../../hooks/useSubmissionFormStore";
import { OfficerSearchComboBox } from "@/features/police/components/officers/OfficerSearchComboBox";
import { StationSearchComboBox } from "@/features/police/components/stations/StationSearchComboBox";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
// 	PoliceStationTiny,
// 	UserTiny,
// } from "@/shared/types/backend-api.types";

export const OfficersStationSection = observer(() => {
	const formStore = useSubmissionFormStore();

	const handleRequestingOfficerChange = (officerId: number | null) => {
		if (officerId) {
			formStore.updateField("requesting_officer_id", officerId);
		} else {
			formStore.setSelectedOfficer("requesting", null);
		}
	};

	const handleSubmittingOfficerChange = (officerId: number | null) => {
		if (officerId) {
			formStore.updateField("submitting_officer_id", officerId);
		} else {
			formStore.setSelectedOfficer("submitting", null);
		}
	};

	const handleStationChange = (stationId: number | null) => {
		if (stationId) {
			formStore.updateField("station_id", stationId);
		} else {
			formStore.setSelectedStation(null);
		}
	};

	const handleBotanistChange = (botanistId: number | null) => {
		if (botanistId) {
			formStore.updateField("approved_botanist_id", botanistId);
		} else {
			formStore.setSelectedBotanist(null);
		}
	};

	const handleFinanceOfficerChange = (financeOfficerId: number | null) => {
		if (financeOfficerId) {
			formStore.updateField("finance_officer_id", financeOfficerId);
		} else {
			formStore.setSelectedFinanceOfficer(null);
		}
	};

	const getFieldError = (field: string): string | undefined => {
		return formStore.validationErrors[field] as string | undefined;
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Officers and Station</CardTitle>
				<CardDescription>
					Select the officers and station associated with this
					submission
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Requesting Officer */}
				<div className="space-y-2">
					<Label htmlFor="requesting_officer">
						Requesting Officer
					</Label>
					<OfficerSearchComboBox
						value={formStore.formData.requesting_officer_id ?? null}
						onValueChange={handleRequestingOfficerChange}
						placeholder="Search for requesting officer..."
						error={!!getFieldError("requesting_officer")}
						showExternalAddButton={true}
					/>
					{getFieldError("requesting_officer") && (
						<p className="text-sm text-red-500">
							{getFieldError("requesting_officer")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Officer who requested the botanical identification
					</p>
				</div>

				{/* Submitting Officer */}
				<div className="space-y-2">
					<Label htmlFor="submitting_officer">
						Submitting Officer
					</Label>
					<OfficerSearchComboBox
						value={formStore.formData.submitting_officer_id ?? null}
						onValueChange={handleSubmittingOfficerChange}
						placeholder="Search for submitting officer..."
						error={!!getFieldError("submitting_officer")}
						showExternalAddButton={true}
					/>
					{getFieldError("submitting_officer") && (
						<p className="text-sm text-red-500">
							{getFieldError("submitting_officer")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Officer who submitted the samples
					</p>
				</div>

				{/* Station */}
				<div className="space-y-2">
					<Label htmlFor="station">Police Station</Label>
					<StationSearchComboBox
						value={formStore.formData.station_id ?? null}
						onValueChange={handleStationChange}
						placeholder="Search for police station..."
						error={!!getFieldError("station")}
						showExternalAddButton={true}
					/>
					{getFieldError("station") && (
						<p className="text-sm text-red-500">
							{getFieldError("station")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Station where the samples originated
					</p>
				</div>

				{/* Approved Botanist */}
				<div className="space-y-2">
					<Label htmlFor="approved_botanist">Approved Botanist</Label>
					<UserSearchCombobox
						value={formStore.formData.approved_botanist_id ?? null}
						onValueChange={handleBotanistChange}
						placeholder="Search for botanist..."
						roleFilter="botanist"
						error={!!getFieldError("approved_botanist")}
						showExternalInviteButton={true}
					/>
					{getFieldError("approved_botanist") && (
						<p className="text-sm text-red-500">
							{getFieldError("approved_botanist")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Botanist assigned to perform the identification
					</p>
				</div>

				{/* Finance Officer */}
				<div className="space-y-2">
					<Label htmlFor="finance_officer">Finance Officer</Label>
					<UserSearchCombobox
						value={formStore.formData.finance_officer_id ?? null}
						onValueChange={handleFinanceOfficerChange}
						placeholder="Search for finance officer..."
						roleFilter="finance"
						exclude={
							formStore.formData.approved_botanist_id
								? [formStore.formData.approved_botanist_id]
								: []
						}
						error={!!getFieldError("finance_officer")}
						showExternalInviteButton={true}
					/>
					{getFieldError("finance_officer") && (
						<p className="text-sm text-red-500">
							{getFieldError("finance_officer")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Finance officer assigned to handle billing
					</p>
				</div>
			</CardContent>
		</Card>
	);
});

OfficersStationSection.displayName = "OfficersStationSection";
