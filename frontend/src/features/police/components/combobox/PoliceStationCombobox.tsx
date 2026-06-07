import { Building, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/style.utils";
import { BaseCombobox } from "@/shared/components/combobox";
import { policeStationsService } from "../../services/policeStations.service";
import { useStationById } from "../../hooks/useStationById";
import type { PoliceStation } from "@/shared/types/backend-api.types";

/**
 * PoliceStationCombobox - Police station search and selection component
 *
 * Thin wrapper around BaseCombobox with station-specific logic and rendering.
 * Accepts a numeric station ID and emits ID changes, managing the full entity
 * object internally via useStationById.
 *
 * @example
 * ```tsx
 * <PoliceStationCombobox
 *   value={stationId}
 *   onValueChange={setStationId}
 *   placeholder="Search for a station..."
 * />
 * ```
 */

export interface PoliceStationComboboxProps {
	value: number | null;
	onValueChange: (stationId: number | null) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export const PoliceStationCombobox = ({
	value,
	onValueChange,
	placeholder = "Search stations...",
	disabled,
	className,
}: PoliceStationComboboxProps) => {
	// Load selected station for display when value is provided
	const { data: selectedStation } = useStationById(value);

	// Search function that calls the stations list API
	const searchStations = async (
		searchTerm: string
	): Promise<PoliceStation[]> => {
		const response = await policeStationsService.getStations({
			search: searchTerm,
		});
		return response.results;
	};

	return (
		<BaseCombobox<PoliceStation>
			searchFn={searchStations}
			value={selectedStation ?? null}
			onChange={(station: PoliceStation | null) =>
				onValueChange(station?.id ?? null)
			}
			getItemKey={(station: PoliceStation) => station.id}
			renderSelected={(station: PoliceStation, onClear: () => void) => (
				<SelectedStationDisplay station={station} onClear={onClear} />
			)}
			renderMenuItem={(
				station: PoliceStation,
				onSelect: (station: PoliceStation) => void,
				isHighlighted: boolean
			) => (
				<StationMenuItem
					station={station}
					onSelect={onSelect}
					isHighlighted={isHighlighted}
				/>
			)}
			placeholder={placeholder}
			disabled={disabled}
			className={className}
			ariaLabel="Search for a police station"
		/>
	);
};

PoliceStationCombobox.displayName = "PoliceStationCombobox";

// =========================================== INTERNAL RENDERING COMPONENTS ====================================================

interface SelectedStationDisplayProps {
	station: PoliceStation;
	onClear: () => void;
}

const SelectedStationDisplay = ({
	station,
	onClear,
}: SelectedStationDisplayProps) => (
	<div
		className={cn(
			"flex items-center relative px-2 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 h-11"
		)}
	>
		<Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
		<span className="ml-2 text-sm truncate flex-1">{station.name}</span>
		<Button
			variant="ghost"
			size="sm"
			className="flex-shrink-0 ml-1 h-7 w-7 p-0 hover:bg-gray-200 dark:hover:bg-gray-600"
			onClick={onClear}
			tabIndex={-1}
			aria-label="Clear selected station"
		>
			<X className="h-3.5 w-3.5" />
		</Button>
	</div>
);

interface StationMenuItemProps {
	station: PoliceStation;
	onSelect: (station: PoliceStation) => void;
	isHighlighted: boolean;
}

const StationMenuItem = ({
	station,
	onSelect,
	isHighlighted,
}: StationMenuItemProps) => (
	<button
		type="button"
		className={cn(
			"w-full text-left p-2 flex items-center transition-colors cursor-pointer",
			isHighlighted && "bg-gray-200 dark:bg-gray-600"
		)}
		onMouseDown={(e) => {
			e.stopPropagation();
		}}
		onClick={(e) => {
			e.stopPropagation();
			onSelect(station);
		}}
	>
		<Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
		<div className="flex flex-col ml-2 min-w-0">
			<span className="text-sm truncate">{station.name}</span>
			{station.address && (
				<span className="text-xs text-muted-foreground truncate">
					{station.address}
				</span>
			)}
		</div>
	</button>
);
