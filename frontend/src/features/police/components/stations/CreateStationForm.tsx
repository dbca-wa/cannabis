import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
	createStationSchema,
	type CreateStationFormData,
} from "../../schemas/policeStationSchemas";
import { useCreateStation } from "../../hooks/usePoliceStations";

interface CreateStationFormProps {
	onSuccess?: () => void;
	onCancel?: () => void;
}

export function CreateStationForm({
	onSuccess,
	onCancel,
}: CreateStationFormProps) {
	const createStationMutation = useCreateStation();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<CreateStationFormData>({
		resolver: zodResolver(createStationSchema),
		defaultValues: {
			name: "",
			address: "",
			phone: "",
		},
	});

	const onSubmit = async (data: CreateStationFormData) => {
		try {
			await createStationMutation.mutateAsync(data);
			reset();
			onSuccess?.();
		} catch (error) {
			// Error handling is done in the mutation hook
			console.error("Form submission error:", error);
		}
	};

	const isLoading = isSubmitting || createStationMutation.isPending;

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
					<p className="text-sm text-red-600">
						{errors.name.message}
					</p>
				)}
			</div>

			{/* Address */}
			<div className="space-y-2">
				<Label htmlFor="address">
					Address <span className="text-red-500">*</span>
				</Label>
				<Textarea
					id="address"
					{...register("address")}
					placeholder="Enter station address"
					disabled={isLoading}
					rows={3}
				/>
				{errors.address && (
					<p className="text-sm text-red-600">
						{errors.address.message}
					</p>
				)}
			</div>

			{/* Phone */}
			<div className="space-y-2">
				<Label htmlFor="phone">
					Phone Number <span className="text-red-500">*</span>
				</Label>
				<Input
					id="phone"
					{...register("phone")}
					placeholder="Enter phone number"
					disabled={isLoading}
				/>
				{errors.phone && (
					<p className="text-sm text-red-600">
						{errors.phone.message}
					</p>
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
				<Button type="submit" disabled={isLoading}>
					{isLoading ? "Creating..." : "Create Station"}
				</Button>
			</div>
		</form>
	);
}
