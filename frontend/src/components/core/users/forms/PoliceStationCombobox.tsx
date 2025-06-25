import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useStationsStore } from "@/stores/rootStore";
import { observer } from "mobx-react";

interface PoliceStationComboboxProps {
	value?: string;
	onValueChange?: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
}

const PoliceStationCombobox = observer(
	({
		value: controlledValue,
		onValueChange,
		placeholder = "Select station...",
		disabled = false,
	}: PoliceStationComboboxProps) => {
		const [open, setOpen] = useState(false);
		const [internalValue, setInternalValue] = useState("");
		const stationsStore = useStationsStore();

		// Use controlled value if provided, otherwise use internal state
		const value =
			controlledValue !== undefined ? controlledValue : internalValue;
		const setValue = (newValue: string) => {
			if (controlledValue !== undefined) {
				onValueChange?.(newValue);
			} else {
				setInternalValue(newValue);
			}
		};

		const handleOpenChange = (newOpen: boolean) => {
			console.log("Popover open state changing:", newOpen); // Debug log
			if (!disabled) {
				setOpen(newOpen);
				// Fetch stations when opening if not already loaded
				if (newOpen && stationsStore.stations.length === 0) {
					stationsStore.fetchStations();
				}
			}
		};

		const handleSelect = (currentValue: string) => {
			console.log("Station selected:", currentValue); // Debug log
			const newValue = currentValue === value ? "" : currentValue;
			setValue(newValue);
			setOpen(false);
		};

		const selectedStation = stationsStore.stationOptions.find(
			(station) => station.value === value
		);

		const stations = stationsStore.stationOptions;

		return (
			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled || stationsStore.isLoading}
						className="w-full justify-between"
						onClick={() => {
							console.log(
								"Button clicked, current open state:",
								open
							); // Debug log
						}}
					>
						{stationsStore.isLoading
							? "Loading stations..."
							: selectedStation
							? selectedStation.name
							: placeholder}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="p-0 z-[1001]"
					align="start"
					sideOffset={4}
					style={{ width: "var(--radix-popover-trigger-width)" }}
				>
					<Command>
						<CommandInput
							placeholder="Search station..."
							className="h-9"
						/>
						<CommandList>
							<CommandEmpty>
								{stationsStore.isLoading
									? "Loading..."
									: "No station found."}
							</CommandEmpty>
							<CommandGroup>
								{stations.map((station) => (
									<CommandItem
										key={station.value}
										value={station.value}
										onSelect={handleSelect}
										className="cursor-pointer"
									>
										{station.name}
										<Check
											className={cn(
												"ml-auto h-4 w-4",
												value === station.value
													? "opacity-100"
													: "opacity-0"
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		);
	}
);

export default PoliceStationCombobox;
