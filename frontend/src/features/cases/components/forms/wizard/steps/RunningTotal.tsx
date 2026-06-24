interface RunningTotalProps {
	subtotal: number;
	taxAmount: number;
	grandTotal: number;
}

const formatCurrency = (value: number): string => {
	return value.toLocaleString("en-AU", {
		style: "currency",
		currency: "AUD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
};

/**
 * Displays subtotal, tax amount, and grand total as currency values.
 * Visually separated from the line items above with a top border.
 */
export const RunningTotal = ({
	subtotal,
	taxAmount,
	grandTotal,
}: RunningTotalProps) => {
	return (
		<div className="mt-4 border-t border-border pt-4 space-y-2">
			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<span>Subtotal</span>
				<span>{formatCurrency(subtotal)}</span>
			</div>

			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<span>Tax</span>
				<span>{formatCurrency(taxAmount)}</span>
			</div>

			<div className="border-t border-border pt-2 mt-2">
				<div className="flex items-center justify-between text-base font-semibold">
					<span>Total</span>
					<span>{formatCurrency(grandTotal)}</span>
				</div>
			</div>
		</div>
	);
};
