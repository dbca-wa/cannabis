import { useState, useMemo, useCallback } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { LineItemRow } from "./LineItemRow";
import { RunningTotal } from "./RunningTotal";
import { BaseFeeModal } from "@/shared/components/BaseFeeModal";
import type { SystemSettings } from "@/shared/types/backend-api.types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LineItemPayload {
	fee_type: "certificate" | "bag" | "fuel" | "call_out" | "forensic";
	quantity: number;
	rate: number;
}

interface LineItemState {
	key: string;
	label: string;
	rateKey: keyof SystemSettings;
	enabled: boolean;
	quantity: string;
	preservedQuantity: string;
	isTax?: boolean;
	isFixedQuantity?: boolean;
}

export interface PreservedLineItemConfig {
	lineItems: LineItemPayload[];
	taxEnabled: boolean;
}

export interface LineItemConfiguratorProps {
	settings: SystemSettings;
	caseData: Record<string, unknown> | null;
	onGenerate: (lineItems: LineItemPayload[], taxEnabled: boolean) => void;
	isGenerating: boolean;
	customerNumber: string;
	onCustomerNumberChange: (value: string) => void;
	customerNumberError: string | null;
	onRateUpdate: (rateKey: string, value: string) => Promise<void>;
	/** Preserved configuration from a previous generation (used on restart) */
	preservedConfig?: PreservedLineItemConfig | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const FEE_TYPE_MAP: Record<string, LineItemPayload["fee_type"]> = {
	certificate: "certificate",
	bag: "bag",
	fuel: "fuel",
	call_out: "call_out",
	forensic: "forensic",
};

/** Parse a rate string from SystemSettings into a number. */
const parseRate = (value: string): number => {
	const n = parseFloat(value);
	return isNaN(n) ? 0 : n;
};

/** Format a number as a currency string. */
const formatCurrency = (value: number): string => `$${value.toFixed(2)}`;

/**
 * Validates a quantity string.
 * Returns an error message or null if valid.
 */
const validateQuantity = (value: string): string | null => {
	if (value.trim() === "") {
		return "A quantity is required.";
	}
	if (!/^\d+(\.\d+)?$/.test(value.trim())) {
		return "Quantity must be a valid number.";
	}
	const parsed = parseFloat(value);
	if (isNaN(parsed) || parsed <= 0) {
		return "Quantity must be greater than zero.";
	}
	return null;
};

/** Round a number to 2 decimal places using half-up rounding. */
const roundTwo = (n: number): number =>
	Math.round((n + Number.EPSILON) * 100) / 100;

/** Derive initial quantity for certificates from case data. */
const getCertificateCount = (
	caseData: Record<string, unknown> | null
): string => {
	if (!caseData) return "0";
	if (typeof caseData.certificates_count === "number")
		return String(caseData.certificates_count);
	if (Array.isArray(caseData.certificates))
		return String(caseData.certificates.length);
	return "0";
};

/** Derive initial quantity for bags from case data. */
const getBagCount = (caseData: Record<string, unknown> | null): string => {
	if (!caseData) return "0";
	if (typeof caseData.bags_count === "number")
		return String(caseData.bags_count);
	if (Array.isArray(caseData.bags)) return String(caseData.bags.length);
	return "0";
};

/** Derive fuel distance from case data. */
const getFuelDistance = (caseData: Record<string, unknown> | null): string => {
	if (!caseData) return "";
	if (typeof caseData.fuel_distance_km === "number")
		return String(caseData.fuel_distance_km);
	if (
		typeof caseData.fuel_distance_km === "string" &&
		caseData.fuel_distance_km !== ""
	)
		return caseData.fuel_distance_km;
	return "";
};

/** Derive forensic hours from case data. */
const getForensicHours = (caseData: Record<string, unknown> | null): string => {
	if (!caseData) return "";
	if (typeof caseData.forensic_hours === "number")
		return String(caseData.forensic_hours);
	if (
		typeof caseData.forensic_hours === "string" &&
		caseData.forensic_hours !== ""
	)
		return caseData.forensic_hours;
	return "";
};

// ── Initialisation ───────────────────────────────────────────────────────────

const buildInitialLineItems = (
	caseData: Record<string, unknown> | null
): LineItemState[] => {
	const certQty = getCertificateCount(caseData);
	const bagQty = getBagCount(caseData);
	const fuelQty = getFuelDistance(caseData);
	const forensicQty = getForensicHours(caseData);

	return [
		{
			key: "certificate",
			label: "Certificate Cost",
			rateKey: "cost_per_certificate",
			enabled: parseInt(certQty, 10) > 0,
			quantity: certQty,
			preservedQuantity: certQty,
			isFixedQuantity: true,
		},
		{
			key: "bag",
			label: "Bag Identification",
			rateKey: "cost_per_bag",
			enabled: parseInt(bagQty, 10) > 0,
			quantity: bagQty,
			preservedQuantity: bagQty,
			isFixedQuantity: true,
		},
		{
			key: "fuel",
			label: "Fuel per KM",
			rateKey: "cost_per_kilometer_fuel",
			enabled: false,
			quantity: fuelQty,
			preservedQuantity: fuelQty,
		},
		{
			key: "call_out",
			label: "Call Out Fee",
			rateKey: "call_out_fee",
			enabled: false,
			quantity: "1",
			preservedQuantity: "1",
			isFixedQuantity: true,
		},
		{
			key: "forensic",
			label: "Forensic Hour",
			rateKey: "cost_per_forensic_hour",
			enabled: false,
			quantity: forensicQty,
			preservedQuantity: forensicQty,
		},
		{
			key: "tax",
			label: "Tax Percentage",
			rateKey: "tax_percentage",
			enabled: false,
			quantity: "",
			preservedQuantity: "",
			isTax: true,
		},
	];
};

// ── Component ────────────────────────────────────────────────────────────────

export const LineItemConfigurator = ({
	settings,
	caseData,
	onGenerate,
	isGenerating,
	customerNumber,
	onCustomerNumberChange,
	customerNumberError,
	onRateUpdate,
	preservedConfig,
}: LineItemConfiguratorProps) => {
	const [lineItems, setLineItems] = useState<LineItemState[]>(() => {
		const initial = buildInitialLineItems(caseData);

		// If we have a preserved config from a restart, restore toggle/quantity state
		if (preservedConfig) {
			const { lineItems: preservedPayload, taxEnabled } = preservedConfig;
			return initial.map((item) => {
				if (item.isTax) {
					return { ...item, enabled: taxEnabled };
				}
				const preserved = preservedPayload.find(
					(p) => p.fee_type === FEE_TYPE_MAP[item.key]
				);
				if (preserved) {
					return {
						...item,
						enabled: true,
						quantity: String(preserved.quantity),
						preservedQuantity: String(preserved.quantity),
					};
				}
				// Item was not in the preserved payload = it was toggled off
				return { ...item, enabled: false };
			});
		}

		return initial;
	});
	const [editingRateKey, setEditingRateKey] = useState<string | null>(null);
	const [isSavingRate, setIsSavingRate] = useState(false);
	const [localCustomerError, setLocalCustomerError] = useState<string | null>(
		null
	);

	// ── Toggle handler ─────────────────────────────────────────────────────

	const handleToggle = useCallback((index: number, enabled: boolean) => {
		setLineItems((prev) => {
			const updated = [...prev];
			const item = { ...updated[index] };

			if (enabled) {
				// Restore preserved quantity on toggle on
				item.enabled = true;
				if (item.key === "call_out") {
					item.quantity = "1";
				} else {
					item.quantity = item.preservedQuantity;
				}
			} else {
				// Save current quantity before toggling off
				item.enabled = false;
				item.preservedQuantity = item.quantity;
			}

			updated[index] = item;
			return updated;
		});
	}, []);

	// ── Quantity change handler ────────────────────────────────────────────

	const handleQuantityChange = useCallback((index: number, value: string) => {
		setLineItems((prev) => {
			const updated = [...prev];
			updated[index] = { ...updated[index], quantity: value };
			return updated;
		});
	}, []);

	// ── Validation for each line item ──────────────────────────────────────

	const validationErrors = useMemo(() => {
		return lineItems.map((item) => {
			if (!item.enabled || item.isTax) return null;
			return validateQuantity(item.quantity);
		});
	}, [lineItems]);

	// ── Running total calculations ─────────────────────────────────────────

	const { subtotal, taxAmount, grandTotal, taxEnabled } = useMemo(() => {
		const taxItem = lineItems.find((i) => i.isTax);
		const isTaxEnabled = taxItem?.enabled ?? false;
		const taxPercentage = parseRate(settings.tax_percentage);

		let sub = 0;
		for (const item of lineItems) {
			if (!item.enabled || item.isTax) continue;
			const qty = parseFloat(item.quantity);
			const rate = parseRate(settings[item.rateKey] as string);
			if (isNaN(qty) || qty <= 0) continue;
			sub += roundTwo(qty * rate);
		}
		sub = roundTwo(sub);

		const tax = isTaxEnabled ? roundTwo((sub * taxPercentage) / 100) : 0;
		const total = roundTwo(sub + tax);

		return {
			subtotal: sub,
			taxAmount: tax,
			grandTotal: total,
			taxEnabled: isTaxEnabled,
		};
	}, [lineItems, settings]);

	// ── Line totals for each row ───────────────────────────────────────────

	const lineTotals = useMemo(() => {
		return lineItems.map((item) => {
			if (!item.enabled || item.isTax) return 0;
			const qty = parseFloat(item.quantity);
			const rate = parseRate(settings[item.rateKey] as string);
			if (isNaN(qty) || qty <= 0) return 0;
			return roundTwo(qty * rate);
		});
	}, [lineItems, settings]);

	// ── BaseFeeModal handlers ──────────────────────────────────────────────

	const editingItem = lineItems.find((i) => i.rateKey === editingRateKey);
	const editingRate = editingRateKey
		? ((settings[editingRateKey as keyof SystemSettings] as string) ?? "")
		: "";
	const editingLabel = editingItem?.label ?? "";

	const handleRateClick = useCallback((rateKey: string) => {
		setEditingRateKey(rateKey);
	}, []);

	const handleRateSave = useCallback(
		async (value: string) => {
			if (!editingRateKey) return;
			setIsSavingRate(true);
			try {
				await onRateUpdate(editingRateKey, value);
				setEditingRateKey(null);
			} finally {
				setIsSavingRate(false);
			}
		},
		[editingRateKey, onRateUpdate]
	);

	const handleModalOpenChange = useCallback((open: boolean) => {
		if (!open) setEditingRateKey(null);
	}, []);

	// ── Generate handler ───────────────────────────────────────────────────

	const handleGenerate = useCallback(() => {
		// Validate customer number
		if (!customerNumber || customerNumber.trim() === "") {
			setLocalCustomerError("Customer number is required.");
			return;
		}
		setLocalCustomerError(null);

		// Validate all enabled, non-tax items have valid quantities
		const enabledItems = lineItems.filter((i) => i.enabled && !i.isTax);
		const hasInvalidItems = enabledItems.some((item) => {
			return validateQuantity(item.quantity) !== null;
		});

		if (hasInvalidItems) {
			// Errors are already displayed inline via validationErrors
			return;
		}

		// Assemble payload from enabled non-tax items
		const payload: LineItemPayload[] = enabledItems.map((item) => ({
			fee_type: FEE_TYPE_MAP[item.key],
			quantity: parseFloat(item.quantity),
			rate: parseRate(settings[item.rateKey] as string),
		}));

		onGenerate(payload, taxEnabled);
	}, [customerNumber, lineItems, settings, taxEnabled, onGenerate]);

	// ── Render ─────────────────────────────────────────────────────────────

	const displayedCustomerError = customerNumberError ?? localCustomerError;

	return (
		<div className="space-y-2">
			{/* Line item rows */}
			{lineItems.map((item, index) => (
				<LineItemRow
					key={item.key}
					label={item.label}
					rate={parseRate(settings[item.rateKey] as string)}
					rateFormatted={formatCurrency(
						parseRate(settings[item.rateKey] as string)
					)}
					quantity={item.quantity}
					enabled={item.enabled}
					isTax={item.isTax}
					isFixedQuantity={item.isFixedQuantity}
					lineTotal={lineTotals[index]}
					validationError={validationErrors[index]}
					onToggle={(enabled) => handleToggle(index, enabled)}
					onQuantityChange={(value) => handleQuantityChange(index, value)}
					onRateClick={() => handleRateClick(item.rateKey)}
				/>
			))}

			{/* Running total */}
			<RunningTotal
				subtotal={subtotal}
				taxAmount={taxAmount}
				grandTotal={grandTotal}
			/>

			{/* Customer number input */}
			<div className="mt-6 space-y-2">
				<Label htmlFor="customer-number">Customer Number</Label>
				<Input
					id="customer-number"
					type="text"
					value={customerNumber}
					onChange={(e) => {
						onCustomerNumberChange(e.target.value);
						if (localCustomerError) setLocalCustomerError(null);
					}}
					placeholder="Enter customer number"
					aria-invalid={!!displayedCustomerError}
					aria-describedby={
						displayedCustomerError ? "customer-number-error" : undefined
					}
				/>
				{displayedCustomerError && (
					<p
						id="customer-number-error"
						className="text-sm text-red-600"
						role="alert"
					>
						{displayedCustomerError}
					</p>
				)}
			</div>

			{/* Generate button */}
			<div className="mt-4">
				<Button
					className="w-full bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
					onClick={handleGenerate}
					disabled={isGenerating}
				>
					{isGenerating ? "Generating…" : "Generate Invoice"}
				</Button>
			</div>

			{/* Base fee editing modal */}
			<BaseFeeModal
				open={editingRateKey !== null}
				onOpenChange={handleModalOpenChange}
				rateKey={editingRateKey ?? ""}
				currentValue={editingRate}
				label={editingLabel}
				onSave={handleRateSave}
				isSaving={isSavingRate}
			/>
		</div>
	);
};
