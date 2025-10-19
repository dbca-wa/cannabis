import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Loader2 } from "lucide-react";
import {
	editDefendantSchema,
	type EditDefendantFormData,
} from "../../schemas/defendantSchemas";
import type { Defendant } from "@/shared/types/backend-api.types";

interface EditDefendantFormProps {
	defendant: Defendant;
	onSubmit: (data: EditDefendantFormData) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export const EditDefendantForm: React.FC<EditDefendantFormProps> = ({
	defendant,
	onSubmit,
	onCancel,
	isSubmitting = false,
}) => {
	const form = useForm<EditDefendantFormData>({
		resolver: zodResolver(editDefendantSchema),
		defaultValues: {
			first_name: defendant.first_name || "",
			last_name: defendant.last_name || "",
		},
	});

	const handleSubmit = async (data: EditDefendantFormData) => {
		await onSubmit(data);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className="space-y-4"
			>
				<FormField
					control={form.control}
					name="first_name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>First Name</FormLabel>
							<FormControl>
								<Input
									{...field}
									placeholder="Enter first name (optional)"
									disabled={isSubmitting}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="last_name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								Last Name{" "}
								<span className="text-red-500">*</span>
							</FormLabel>
							<FormControl>
								<Input
									{...field}
									placeholder="Enter last name (required)"
									disabled={isSubmitting}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex justify-end gap-2 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Update Defendant
					</Button>
				</div>
			</form>
		</Form>
	);
};
