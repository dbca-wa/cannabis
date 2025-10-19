import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/shared/components/ui/form";
import { StationSearchComboBox } from "../stations/StationSearchComboBox";
import {
	editOfficerSchema,
	officerRankOptions,
	type EditOfficerFormData,
} from "../../schemas/policeOfficerSchemas";
import type { PoliceOfficerTiny } from "@/shared/types/backend-api.types";

interface EditOfficerFormProps {
	officer: PoliceOfficerTiny;
	onSubmit: (data: unknown) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
}

export const EditOfficerForm = ({
	officer,
	onSubmit,
	onCancel,
	isLoading = false,
}: EditOfficerFormProps) => {
	// Form setup with officer data
	const form = useForm<EditOfficerFormData>({
		resolver: zodResolver(editOfficerSchema),
		defaultValues: {
			badge_number: officer.badge_number || "",
			first_name: officer.first_name || "",
			last_name: officer.last_name || "",
			rank: officer.rank || "unknown", // Use the actual rank from backend, fallback to "unknown"
			station: officer.station ? officer.station.toString() : "none", // Use station ID from backend
		},
	});

	const handleSubmit = async (data: EditOfficerFormData) => {
		try {
			// Transform data to match backend expectations
			const transformedData = {
				badge_number: data.badge_number || undefined,
				first_name: data.first_name || undefined,
				last_name: data.last_name,
				rank: data.rank,
				station:
					data.station && data.station !== "none"
						? parseInt(data.station)
						: undefined,
			};
			await onSubmit(transformedData);
		} catch (error) {
			// Error handling is done in the parent component
			console.error("Form submission error:", error);
		}
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className="space-y-4"
			>
				{/* Badge Number */}
				<FormField
					control={form.control}
					name="badge_number"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Badge Number</FormLabel>
							<FormControl>
								<Input
									placeholder="Enter badge number (optional)"
									{...field}
									value={field.value || ""}
									disabled={isLoading}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* First Name */}
				<FormField
					control={form.control}
					name="first_name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>First Name</FormLabel>
							<FormControl>
								<Input
									placeholder="Enter officer's first name (optional)"
									{...field}
									value={field.value || ""}
									disabled={isLoading}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Last Name */}
				<FormField
					control={form.control}
					name="last_name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Last Name *</FormLabel>
							<FormControl>
								<Input
									placeholder="Enter officer's last name"
									{...field}
									disabled={isLoading}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Rank Selection */}
				<FormField
					control={form.control}
					name="rank"
					render={({ field }) => {
						return (
							<FormItem>
								<FormLabel>Rank *</FormLabel>
								<Select
									onValueChange={(value) => {
										field.onChange(value);
									}}
									value={field.value}
									disabled={isLoading}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select officer rank" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{officerRankOptions.map((rank) => (
											<SelectItem
												key={rank.value}
												value={rank.value}
											>
												{rank.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						);
					}}
				/>

				{/* Station Selection */}
				<FormField
					control={form.control}
					name="station"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Station</FormLabel>
							<FormControl>
								<StationSearchComboBox
									value={
										field.value && field.value !== "none"
											? parseInt(field.value)
											: null
									}
									onValueChange={(stationId) => {
										field.onChange(
											stationId
												? stationId.toString()
												: "none"
										);
									}}
									placeholder="Search for a station (optional)"
									disabled={isLoading}
									error={!!form.formState.errors.station}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Form Actions */}
				<div className="flex justify-end space-x-2 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isLoading}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isLoading}>
						{isLoading ? "Updating..." : "Update Officer"}
					</Button>
				</div>
			</form>
		</Form>
	);
};
