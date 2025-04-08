import { observer } from "mobx-react-lite";
import { ReactNode } from "react";

interface DataDisplayProps<T> {
	getData: () => T;
	renderLabel?: () => string;
	formatValue?: (value: T) => ReactNode;
}

export const DataDisplay = observer(
	<T,>({ getData, renderLabel, formatValue }: DataDisplayProps<T>) => {
		const value = getData();
		const displayValue = formatValue
			? formatValue(value)
			: typeof value === "object"
			? JSON.stringify(value)
			: String(value);

		return (
			<div className="data-item">
				<span className="label">{renderLabel?.() || "Value"}: </span>
				<span className="value">{displayValue}</span>
			</div>
		);
	}
);
