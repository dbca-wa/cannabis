import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	editInvoiceSchema,
	type EditInvoiceFormData,
} from "../../schemas/invoiceSchemas";
import type { Invoice } from "@/shared/types/backend-api.types";

interface EditInvoiceFormProps {
	invoice: Invoice;
	onSubmit: (data: EditInvoiceFormData) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export const EditInvoiceForm: React.FC<EditInvoiceFormProps> = ({
	invoice,
	onSubmit,
	onCancel,
	isSubmitting = false,
}) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<EditInvoiceFormData>({
		resolver: zodResolver(editInvoiceSchema),
		defaultValues: {
			customer_number: invoice.customer_number,
		},
	});

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="invoice_number">Invoice Number</Label>
				<Input
					id="invoice_number"
					type="text"
					value={invoice.invoice_number}
					disabled
					className="bg-gray-50"
				/>
				<p className="text-sm text-gray-500">
					Invoice number is auto-generated and cannot be changed
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
					{isSubmitting ? "Updating..." : "Update Invoice"}
				</Button>
			</div>
		</form>
	);
};
