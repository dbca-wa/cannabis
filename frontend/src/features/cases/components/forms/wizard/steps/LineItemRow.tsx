import { Switch } from "@/shared/components/ui/switch";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/utils";

interface LineItemRowProps {
	label: string;
	rate: number;
	rateFormatted: string;
	quantity: number | string;
	enabled: boolean;
	isTax?: boolean;
	isFixedQuantity?: boolean;
	lineTotal: number;
	validationError: string | null;
	onToggle: (enabled: boolean) => void;
	onQuantityChange: (value: string) => void;
	onRateClick: () => void;
}

const formatCurrency = (value: number): string => {
	return `$${value.toFixed(2)}`;
};

export const LineItemRow = ({
	label,
	rate,
	rateFormatted,
	quantity,
	enabled,
	isTax = false,
	isFixedQuantity = false,
	lineTotal,
	validationError,
	onToggle,
	onQuantityChange,
	onRateClick,
}: LineItemRowProps) => {
	const switchId = `toggle-${label.toLowerCase().replace(/\s+/g, "-")}`;
	const quantityId = `quantity-${label.toLowerCase().replace(/\s+/g, "-")}`;
	const errorId = `error-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<div
			className={cn(
				"flex flex-col gap-1 py-3 border-b border-border/50",
				!enabled && !isTax && "opacity-50"
			)}
		>
			<div className="flex items-center gap-4">
				{/* Toggle */}
				<Switch
					id={switchId}
					checked={enabled}
					onCheckedChange={onToggle}
					aria-label={`Toggle ${label}`}
				/>

				{/* Label */}
				<label
					htmlFor={switchId}
					className="text-sm font-medium min-w-[140px] cursor-pointer select-none"
				>
					{label}
				</label>

				{/* Rate (clickable) */}
				<button
					type="button"
					onClick={onRateClick}
					className={cn(
						"text-sm font-mono min-w-[90px] text-left",
						"cursor-pointer underline decoration-dashed underline-offset-2",
						"hover:text-emerald-600 transition-colors",
						"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-1 -mx-1"
					)}
					aria-label={`Edit ${label} rate: ${rateFormatted}`}
				>
					{isTax ? `${rate}%` : rateFormatted}
				</button>

				{/* Quantity input — hidden for tax rows and disabled rows */}
				{!isTax && enabled && (
					<div className="flex flex-col min-w-[100px]">
						<Input
							id={quantityId}
							type="number"
							step={isFixedQuantity ? "1" : "0.01"}
							min="0"
							value={quantity}
							onChange={(e) => onQuantityChange(e.target.value)}
							className="h-8 w-[100px] text-sm"
							aria-label={`${label} quantity`}
							aria-invalid={!!validationError}
							aria-describedby={validationError ? errorId : undefined}
							disabled={isFixedQuantity}
						/>
					</div>
				)}

				{/* Line total — hidden for tax rows */}
				{!isTax && (
					<span className="text-sm font-mono ml-auto font-medium min-w-[80px] text-right">
						{enabled ? formatCurrency(lineTotal) : "—"}
					</span>
				)}
			</div>

			{/* Validation error */}
			{validationError && enabled && !isTax && (
				<p
					id={errorId}
					className="text-xs text-red-600 ml-[calc(36px+16px+140px+16px)]"
					role="alert"
				>
					{validationError}
				</p>
			)}
		</div>
	);
};

export type { LineItemRowProps };
