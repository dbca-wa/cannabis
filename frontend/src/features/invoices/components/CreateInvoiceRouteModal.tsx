import React from "react";
import { useNavigate } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { CreateInvoiceForm } from "./forms";
import { useCreateInvoice } from "../hooks/useInvoices";
import type { CreateInvoiceFormData } from "../schemas/invoiceSchemas";

export const CreateInvoiceRouteModal: React.FC = () => {
	const navigate = useNavigate();
	const { mutate: createInvoice, isPending: isCreating } = useCreateInvoice();

	const handleClose = () => {
		navigate("/docs/invoices");
	};

	const handleSubmit = async (data: CreateInvoiceFormData) => {
		createInvoice(data, {
			onSuccess: () => {
				handleClose();
			},
		});
	};

	return (
		<Dialog open onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Create New Invoice</DialogTitle>
					<DialogDescription>
						Generate a new invoice for a submission. The invoice
						number will be auto-generated.
					</DialogDescription>
				</DialogHeader>
				<CreateInvoiceForm
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={isCreating}
				/>
			</DialogContent>
		</Dialog>
	);
};
