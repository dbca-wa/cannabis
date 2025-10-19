import React from "react";
import { useNavigate, useParams } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { EditInvoiceForm } from "./forms";
import { useInvoiceById, useUpdateInvoice } from "../hooks/useInvoices";
import type { EditInvoiceFormData } from "../schemas/invoiceSchemas";

export const EditInvoiceRouteModal: React.FC = () => {
	const navigate = useNavigate();
	const { invoiceId } = useParams<{ invoiceId: string }>();
	const id = invoiceId ? parseInt(invoiceId) : null;

	const { data: invoice, isLoading } = useInvoiceById(id);
	const { mutate: updateInvoice, isPending: isUpdating } = useUpdateInvoice();

	const handleClose = () => {
		navigate("/docs/invoices");
	};

	const handleSubmit = async (data: EditInvoiceFormData) => {
		if (!id) return;

		updateInvoice(
			{ id, data },
			{
				onSuccess: () => {
					handleClose();
				},
			}
		);
	};

	if (isLoading) {
		return (
			<Dialog open onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Edit Invoice</DialogTitle>
						<DialogDescription>
							Loading invoice details...
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (!invoice) {
		return (
			<Dialog open onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Invoice Not Found</DialogTitle>
						<DialogDescription>
							The invoice you're trying to edit doesn't exist or
							has been deleted.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 text-red-600">
						<AlertCircle className="h-5 w-5" />
						<p>Invoice not found</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Invoice</DialogTitle>
					<DialogDescription>
						Update the invoice details. The invoice number cannot be
						changed.
					</DialogDescription>
				</DialogHeader>
				<EditInvoiceForm
					invoice={invoice}
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={isUpdating}
				/>
			</DialogContent>
		</Dialog>
	);
};
