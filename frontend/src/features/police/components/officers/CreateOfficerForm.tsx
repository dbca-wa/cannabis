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
	createOfficerSchema,
	officerRankOptions,
	type CreateOfficerFormData,
} from "../../schemas/policeOfficerSchemas";

interface CreateOfficerFormProps {
	onSubmit: (data: unknown) => Promise<void>;
	onCancel: () => void;
	isLoading?: boolean;
}

export const CreateOfficerForm = ({
	onSubmit,
	onCancel,
	isLoading = false,
}: CreateOfficerFormProps) => {
	// Form setup
	const form = useForm<CreateOfficerFormData>({
		resolver: zodResolver(createOfficerSchema),
		defaultValues: {
			badge_number: "",
			first_name: "",
			last_name: "",
			rank: "constable",
			station: "none",
		},
	});

	const handleSubmit = async (data: CreateOfficerFormData) => {
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
			form.reset();
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
					render={({ field }) => (
						<FormItem>
							<FormLabel>Rank *</FormLabel>
							<Select
								onValueChange={field.onChange}
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
					)}
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
						{isLoading ? "Creating..." : "Create Officer"}
					</Button>
				</div>
			</form>
		</Form>
	);
};
