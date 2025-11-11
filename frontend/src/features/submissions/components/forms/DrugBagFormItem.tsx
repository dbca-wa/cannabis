import React from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Trash2, GripVertical } from "lucide-react";
import type {
	DrugBagFormData,
	ValidationErrors,
} from "../../stores/submissionForm.store";
import type { DrugBagContentType } from "@/shared/types/backend-api.types";

interface DrugBagFormItemProps {
	bag: DrugBagFormData;
	index: number;
	onUpdate: (data: Partial<DrugBagFormData>) => void;
	onRemove: () => void;
	validationErrors: ValidationErrors;
}

// Content type options
const CONTENT_TYPE_OPTIONS: { value: DrugBagContentType; label: string }[] = [
	{ value: "plant", label: "Plant Material" },
	{ value: "plant_material", label: "Plant Material (Generic)" },
	{ value: "cutting", label: "Cutting" },
	{ value: "stalk", label: "Stalk" },
	{ value: "stem", label: "Stem" },
	{ value: "seed", label: "Seed" },
	{ value: "seed_material", label: "Seed Material" },
	{ value: "unknown_seed", label: "Unknown Seed" },
	{ value: "seedling", label: "Seedling" },
	{ value: "head", label: "Head" },
	{ value: "rootball", label: "Rootball" },
	{ value: "poppy", label: "Poppy" },
	{ value: "poppy_plant", label: "Poppy Plant" },
	{ value: "poppy_capsule", label: "Poppy Capsule" },
	{ value: "poppy_head", label: "Poppy Head" },
	{ value: "poppy_seed", label: "Poppy Seed" },
	{ value: "mushroom", label: "Mushroom" },
	{ value: "tablet", label: "Tablet" },
	{ value: "unknown", label: "Unknown" },
	{ value: "unsure", label: "Unsure" },
];

export const DrugBagFormItem: React.FC<DrugBagFormItemProps> = ({
	bag,
	index,
	onUpdate,
	onRemove,
	validationErrors,
}) => {
	const getFieldError = (field: string): string | undefined => {
		const errorKey = `bags.${index}.${field}`;
		return validationErrors[errorKey] as string | undefined;
	};

	return (
		<Card className="relative">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
						<CardTitle className="text-base">
							Bag #{index + 1}
						</CardTitle>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* REQUIRED FIELDS - Above divider */}

				{/* Content Type */}
				<div className="space-y-2">
					<Label
						htmlFor={`content_type_${index}`}
						className="required"
					>
						Content Type
					</Label>
					<Select
						value={bag.content_type}
						onValueChange={(value) =>
							onUpdate({
								content_type: value as DrugBagContentType,
							})
						}
					>
						<SelectTrigger
							id={`content_type_${index}`}
							className={
								getFieldError("content_type")
									? "border-red-500"
									: ""
							}
						>
							<SelectValue placeholder="Select content type" />
						</SelectTrigger>
						<SelectContent>
							{CONTENT_TYPE_OPTIONS.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{getFieldError("content_type") && (
						<p className="text-sm text-red-500">
							{getFieldError("content_type")}
						</p>
					)}
				</div>

				{/* Original Seal Tag Numbers */}
				<div className="space-y-2">
					<Label
						htmlFor={`seal_tag_numbers_${index}`}
						className="required"
					>
						Original Seal Tag Numbers
					</Label>
					<Input
						id={`seal_tag_numbers_${index}`}
						value={bag.seal_tag_numbers}
						onChange={(e) =>
							onUpdate({ seal_tag_numbers: e.target.value })
						}
						placeholder="Enter original tag numbers"
						className={
							getFieldError("seal_tag_numbers")
								? "border-red-500"
								: ""
						}
					/>
					{getFieldError("seal_tag_numbers") && (
						<p className="text-sm text-red-500">
							{getFieldError("seal_tag_numbers")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Original tag numbers from police
					</p>
				</div>

				{/* New Seal Tag Numbers */}
				<div className="space-y-2">
					<Label
						htmlFor={`new_seal_tag_numbers_${index}`}
						className="required"
					>
						New Seal Tag Numbers
					</Label>
					<Input
						id={`new_seal_tag_numbers_${index}`}
						value={bag.new_seal_tag_numbers}
						onChange={(e) =>
							onUpdate({ new_seal_tag_numbers: e.target.value })
						}
						placeholder="Enter new tag numbers (if resealed)"
						className={
							getFieldError("new_seal_tag_numbers")
								? "border-red-500"
								: ""
						}
					/>
					{getFieldError("new_seal_tag_numbers") && (
						<p className="text-sm text-red-500">
							{getFieldError("new_seal_tag_numbers")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						New tag numbers if bag was resealed
					</p>
				</div>

				{/* Determination */}
				<div className="space-y-2">
					<Label
						htmlFor={`determination_${index}`}
						className="required"
					>
						Determination
					</Label>
					<Select
						value={bag.determination || "pending"}
						onValueChange={(value) =>
							onUpdate({
								determination: value as any,
							})
						}
					>
						<SelectTrigger id={`determination_${index}`}>
							<SelectValue placeholder="Select determination" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="pending">
								Pending Assessment
							</SelectItem>
							<SelectItem value="cannabis_sativa">
								Cannabis sativa
							</SelectItem>
							<SelectItem value="cannabis_indica">
								Cannabis indica
							</SelectItem>
							<SelectItem value="cannabis_hybrid">
								Cannabis (hybrid)
							</SelectItem>
							<SelectItem value="not_cannabis">
								Not Cannabis
							</SelectItem>
							<SelectItem value="degraded">Degraded</SelectItem>
							<SelectItem value="unidentifiable">
								Unidentifiable
							</SelectItem>
							<SelectItem value="inconclusive">
								Inconclusive
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						Botanical identification result
					</p>
				</div>

				{/* OPTIONAL FIELDS - Below divider */}
				<div className="pt-4 border-t space-y-4">
					<p className="text-sm font-medium text-muted-foreground">
						Optional Information
					</p>

					{/* Property Reference */}
					<div className="space-y-2">
						<Label htmlFor={`property_reference_${index}`}>
							Property Reference
						</Label>
						<Input
							id={`property_reference_${index}`}
							value={bag.property_reference}
							onChange={(e) =>
								onUpdate({ property_reference: e.target.value })
							}
							placeholder="Enter property reference number"
							className={
								getFieldError("property_reference")
									? "border-red-500"
									: ""
							}
						/>
						{getFieldError("property_reference") && (
							<p className="text-sm text-red-500">
								{getFieldError("property_reference")}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Property reference or exhibit number
						</p>
					</div>

					{/* Weight Measurements */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Gross Weight */}
						<div className="space-y-2">
							<Label htmlFor={`gross_weight_${index}`}>
								Gross Weight (g)
							</Label>
							<Input
								id={`gross_weight_${index}`}
								type="number"
								step="0.01"
								value={bag.gross_weight}
								onChange={(e) =>
									onUpdate({ gross_weight: e.target.value })
								}
								placeholder="0.00"
								className={
									getFieldError("gross_weight")
										? "border-red-500"
										: ""
								}
							/>
							{getFieldError("gross_weight") && (
								<p className="text-sm text-red-500">
									{getFieldError("gross_weight")}
								</p>
							)}
							<p className="text-xs text-muted-foreground">
								Weight with packaging
							</p>
						</div>

						{/* Net Weight */}
						<div className="space-y-2">
							<Label htmlFor={`net_weight_${index}`}>
								Net Weight (g)
							</Label>
							<Input
								id={`net_weight_${index}`}
								type="number"
								step="0.01"
								value={bag.net_weight}
								onChange={(e) =>
									onUpdate({ net_weight: e.target.value })
								}
								placeholder="0.00"
								className={
									getFieldError("net_weight")
										? "border-red-500"
										: ""
								}
							/>
							{getFieldError("net_weight") && (
								<p className="text-sm text-red-500">
									{getFieldError("net_weight")}
								</p>
							)}
							<p className="text-xs text-muted-foreground">
								Weight without packaging
							</p>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
