import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
	editStationSchema,
	type EditStationFormData,
} from "../../schemas/policeStationSchemas";
import { useUpdateStation } from "../../hooks/usePoliceStations";
import type { PoliceStation } from "@/shared/types/backend-api.types";
import { applyServerFieldErrors } from "@/shared/utils/field-error.utils";

interface EditStationFormProps {
	station: PoliceStation;
	onSuccess?: () => void;
	onCancel?: () => void;
}

export const EditStationForm = ({
	station,
	onSuccess,
	onCancel,
}: EditStationFormProps) => {
	const updateStationMutation = useUpdateStation();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting, isValid },
		setError,
		setValue,
	} = useForm<EditStationFormData>({
		resolver: zodResolver(editStationSchema),
		mode: "onChange",
		defaultValues: {
			name: station.name,
			address: station.address || "",
			phone: station.phone || "",
		},
	});

	/** Title-case a string, handling spaces and hyphens (e.g. "south perth" → "South Perth"). */
	const toTitleCase = (value: string): string =>
		value
			.replace(/\b\w/g, (char) => char.toUpperCase())
			.replace(/-\w/g, (match) => `-${match.charAt(1).toUpperCase()}`);

	const nameField = register("name");

	const onSubmit = async (data: EditStationFormData) => {
		try {
			await updateStationMutation.mutateAsync({
				id: station.id,
				data,
			});
			onSuccess?.();
		} catch (error: unknown) {
			// The mutation shows a toast; keep the message beside the field too.
			applyServerFieldErrors(error, setError, ["name"]);
		}
	};

	const isLoading = isSubmitting || updateStationMutation.isPending;

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			{/* Station Name */}
			<div className="space-y-2">
				<Label htmlFor="name">
					Station Name <span className="text-red-500">*</span>
				</Label>
				<Input
					id="name"
					{...nameField}
					onChange={(e) => {
						setValue("name", toTitleCase(e.target.value), {
							shouldValidate: true,
							shouldDirty: true,
						});
					}}
					placeholder="Enter station name"
					disabled={isLoading}
				/>
				{errors.name && (
					<p className="text-sm text-red-600">{errors.name.message}</p>
				)}
			</div>

			{/* Address */}
			<div className="space-y-2">
				<Label htmlFor="address">Address</Label>
				<Textarea
					id="address"
					{...register("address")}
					placeholder="Enter station address (optional)"
					disabled={isLoading}
					rows={3}
				/>
				{errors.address && (
					<p className="text-sm text-red-600">{errors.address.message}</p>
				)}
			</div>

			{/* Phone */}
			<div className="space-y-2">
				<Label htmlFor="phone">Phone Number</Label>
				<Input
					id="phone"
					{...register("phone")}
					placeholder="Enter phone number (optional)"
					disabled={isLoading}
				/>
				{errors.phone && (
					<p className="text-sm text-red-600">{errors.phone.message}</p>
				)}
			</div>

			{/* Form Actions */}
			<div className="flex items-center justify-end space-x-2 pt-4">
				{onCancel && (
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isLoading}
					>
						Cancel
					</Button>
				)}
				<Button type="submit" disabled={isLoading || !isValid}>
					{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{isLoading ? "Updating..." : "Update Station"}
				</Button>
			</div>
		</form>
	);
};
