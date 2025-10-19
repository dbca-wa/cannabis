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
	FormDescription,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Loader2 } from "lucide-react";
import {
	createCertificateSchema,
	type CreateCertificateFormData,
} from "../../schemas/certificateSchemas";

interface CreateCertificateFormProps {
	onSubmit: (data: CreateCertificateFormData) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export const CreateCertificateForm: React.FC<CreateCertificateFormProps> = ({
	onSubmit,
	onCancel,
	isSubmitting = false,
}) => {
	const form = useForm<CreateCertificateFormData>({
		resolver: zodResolver(createCertificateSchema),
		defaultValues: {
			submission: undefined,
		},
	});

	const handleSubmit = async (data: CreateCertificateFormData) => {
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
					name="submission"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								Submission ID{" "}
								<span className="text-red-500">*</span>
							</FormLabel>
							<FormControl>
								<Input
									{...field}
									type="number"
									placeholder="Enter submission ID"
									disabled={isSubmitting}
									value={field.value || ""}
									onChange={(e) => {
										const value = e.target.value;
										field.onChange(
											value ? parseInt(value) : undefined
										);
									}}
								/>
							</FormControl>
							<FormDescription>
								Enter the submission ID for which to generate a
								certificate. The certificate number will be
								auto-generated.
							</FormDescription>
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
						Generate Certificate
					</Button>
				</div>
			</form>
		</Form>
	);
};
