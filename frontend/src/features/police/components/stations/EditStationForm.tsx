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
	} = useForm<EditStationFormData>({
		resolver: zodResolver(editStationSchema),
		mode: "onChange",
		defaultValues: {
			name: station.name,
			address: station.address || "",
			phone: station.phone || "",
		},
	});

	const onSubmit = async (data: EditStationFormData) => {
		try {
			await updateStationMutation.mutateAsync({
				id: station.id,
				data,
			});
			onSuccess?.();
		} catch (error: unknown) {
			// Surface server-side validation errors (e.g. duplicate name)
			const err = error as { response?: { data?: Record<string, string[]> } };
			const serverErrors = err?.response?.data;
			if (serverErrors) {
				if (serverErrors.name) {
					setError("name", {
						message: Array.isArray(serverErrors.name)
							? serverErrors.name[0]
							: (serverErrors.name as string),
					});
				}
			}
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
					{...register("name")}
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
