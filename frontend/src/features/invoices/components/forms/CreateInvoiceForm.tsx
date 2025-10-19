import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	createInvoiceSchema,
	type CreateInvoiceFormData,
} from "../../schemas/invoiceSchemas";

interface CreateInvoiceFormProps {
	onSubmit: (data: CreateInvoiceFormData) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export const CreateInvoiceForm: React.FC<CreateInvoiceFormProps> = ({
	onSubmit,
	onCancel,
	isSubmitting = false,
}) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<CreateInvoiceFormData>({
		resolver: zodResolver(createInvoiceSchema),
	});

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="submission" className="required">
					Submission ID
				</Label>
				<Input
					id="submission"
					type="number"
					{...register("submission", { valueAsNumber: true })}
					placeholder="Enter submission ID"
					className={errors.submission ? "border-red-500" : ""}
					disabled={isSubmitting}
				/>
				{errors.submission && (
					<p className="text-sm text-red-500">
						{errors.submission.message}
					</p>
				)}
				<p className="text-sm text-gray-500">
					The invoice will be generated for this submission
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="customer_number" className="required">
					Customer Number
				</Label>
				<Input
					id="customer_number"
					type="text"
					{...register("customer_number")}
					placeholder="Enter customer number"
					className={errors.customer_number ? "border-red-500" : ""}
					disabled={isSubmitting}
					maxLength={20}
				/>
				{errors.customer_number && (
					<p className="text-sm text-red-500">
						{errors.customer_number.message}
					</p>
				)}
				<p className="text-sm text-gray-500">
					Customer reference number for billing (max 20 characters)
				</p>
			</div>

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
					{isSubmitting ? "Creating..." : "Create Invoice"}
				</Button>
			</div>
		</form>
	);
};
