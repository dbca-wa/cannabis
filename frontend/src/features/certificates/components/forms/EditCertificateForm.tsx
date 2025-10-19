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
	editCertificateSchema,
	type EditCertificateFormData,
} from "../../schemas/certificateSchemas";
import type { Certificate } from "@/shared/types/backend-api.types";

interface EditCertificateFormProps {
	certificate: Certificate;
	onSubmit: (data: EditCertificateFormData) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export const EditCertificateForm: React.FC<EditCertificateFormProps> = ({
	certificate,
	onSubmit,
	onCancel,
	isSubmitting = false,
}) => {
	const form = useForm<EditCertificateFormData>({
		resolver: zodResolver(editCertificateSchema),
		defaultValues: {
			submission: certificate.submission,
		},
	});

	const handleSubmit = async (data: EditCertificateFormData) => {
		await onSubmit(data);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className="space-y-4"
			>
				<div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded mb-4">
					<p className="text-sm text-blue-900 dark:text-blue-100">
						<strong>Certificate Number:</strong>{" "}
						{certificate.certificate_number}
					</p>
				</div>

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
								Update the submission ID for this certificate.
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
						Update Certificate
					</Button>
				</div>
			</form>
		</Form>
	);
};
