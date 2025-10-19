import React from "react";
import { useNavigate, useParams } from "react-router";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { useInvoiceById, useDeleteInvoice } from "../hooks/useInvoices";

export const DeleteInvoiceRouteModal: React.FC = () => {
	const navigate = useNavigate();
	const { invoiceId } = useParams<{ invoiceId: string }>();
	const id = invoiceId ? parseInt(invoiceId) : null;

	const { data: invoice, isLoading } = useInvoiceById(id);
	const { mutate: deleteInvoice, isPending: isDeleting } = useDeleteInvoice();

	const handleClose = () => {
		navigate("/docs/invoices");
	};

	const handleDelete = () => {
		if (!id) return;

		deleteInvoice(id, {
			onSuccess: () => {
				handleClose();
			},
		});
	};

	if (isLoading) {
		return (
			<AlertDialog open onOpenChange={handleClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Invoice</AlertDialogTitle>
						<AlertDialogDescription>
							Loading invoice details...
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-2">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
					</div>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	if (!invoice) {
		return (
			<AlertDialog open onOpenChange={handleClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Invoice Not Found</AlertDialogTitle>
						<AlertDialogDescription>
							The invoice you're trying to delete doesn't exist or
							has been deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="flex items-center gap-2 text-red-600">
						<AlertCircle className="h-5 w-5" />
						<p>Invoice not found</p>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleClose}>
							Close
						</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	return (
		<AlertDialog open onOpenChange={handleClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Invoice</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete this invoice? This
						action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="space-y-2 py-4">
					<div className="flex justify-between">
						<span className="font-medium">Invoice Number:</span>
						<span>{invoice.invoice_number}</span>
					</div>
					<div className="flex justify-between">
						<span className="font-medium">Customer Number:</span>
						<span>{invoice.customer_number}</span>
					</div>
					<div className="flex justify-between">
						<span className="font-medium">Created:</span>
						<span>
							{new Date(invoice.created_at).toLocaleDateString()}
						</span>
					</div>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel
						onClick={handleClose}
						disabled={isDeleting}
					>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={isDeleting}
						className="bg-red-600 hover:bg-red-700"
					>
						{isDeleting ? "Deleting..." : "Delete Invoice"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
