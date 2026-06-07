import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Loader2 } from "lucide-react";
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
		mode: "onChange",
		defaultValues: {
			badge_number: officer.badge_number || "",
			first_name: officer.first_name || "",
			last_name: officer.last_name || "",
			rank: officer.rank || "unknown",
			station: officer.station ? officer.station.toString() : "none",
		},
	});

	const handleSubmit = async (data: EditOfficerFormData) => {
		try {
			const transformedData = {
				badge_number: data.badge_number || null,
				first_name: data.first_name || null,
				last_name: data.last_name,
				rank: data.rank,
				station:
					data.station && data.station !== "none"
						? parseInt(data.station)
						: null,
			};
			await onSubmit(transformedData);
		} catch (error: unknown) {
			// Surface server-side validation errors
			const err = error as { response?: { data?: Record<string, string[]> } };
			const serverErrors = err?.response?.data;
			if (serverErrors) {
				if (serverErrors.last_name) {
					form.setError("last_name", {
						message: Array.isArray(serverErrors.last_name)
							? serverErrors.last_name[0]
							: (serverErrors.last_name as string),
					});
				}
				if (serverErrors.badge_number) {
					form.setError("badge_number", {
						message: Array.isArray(serverErrors.badge_number)
							? serverErrors.badge_number[0]
							: (serverErrors.badge_number as string),
					});
				}
			}
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
							<FormLabel>
								Last Name <span className="text-red-500">*</span>
							</FormLabel>
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
								<FormLabel>
									Rank <span className="text-red-500">*</span>
								</FormLabel>
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
											<SelectItem key={rank.value} value={rank.value}>
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
										field.onChange(stationId ? stationId.toString() : "none");
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
					<Button type="submit" disabled={isLoading || !form.formState.isValid}>
						{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isLoading ? "Updating..." : "Update Officer"}
					</Button>
				</div>
			</form>
		</Form>
	);
};
