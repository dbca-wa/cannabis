import { Controller } from "react-hook-form";
import { Label } from "@/shared/components/ui/label";
import { UserSearchCombobox } from "./UserSearchCombobox";
import { cn } from "@/shared/utils";

interface UserSearchFieldProps {
	name: string;
	label: string;
	placeholder?: string;
	helperText?: string;
	required?: boolean;
	disabled?: boolean;
	kind?: "All" | "DBCA";
	exclude?: number[];
	className?: string;
}

export const UserSearchField = ({
	name,
	label,
	placeholder,
	helperText,
	required = false,
	disabled = false,
	kind = "All",
	exclude = [],
	className,
}: UserSearchFieldProps) => {
	return (
		<Controller
			name={name}
			render={({ field, fieldState }) => (
				<div className={cn("space-y-2", className)}>
					<Label htmlFor={name} className="text-sm font-medium">
						{label}
						{required && (
							<span className="text-red-500 ml-1">*</span>
						)}
					</Label>
					<UserSearchCombobox
						value={field.value || null}
						onValueChange={field.onChange}
						placeholder={placeholder}
						disabled={disabled}
						kind={kind}
						exclude={exclude}
						required={required}
						error={!!fieldState.error}
					/>
					{fieldState.error && (
						<p className="text-sm text-red-500">
							{fieldState.error.message}
						</p>
					)}
					{helperText && !fieldState.error && (
						<p className="text-sm text-muted-foreground">
							{helperText}
						</p>
					)}
				</div>
			)}
		/>
	);
};
