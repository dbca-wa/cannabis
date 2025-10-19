"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/shared/utils";

import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";

interface Calendar22Props {
	value?: string; // ISO date string (YYYY-MM-DD)
	onChange: (date: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	error?: boolean;
}

export default function Calendar22({
	value,
	onChange,
	placeholder = "Select date",
	disabled = false,
	className,
	error = false,
}: Calendar22Props) {
	const [open, setOpen] = React.useState(false);
	const selectedDate = value ? new Date(value) : undefined;

	const handleSelect = (date: Date | undefined) => {
		if (date) {
			// Format as YYYY-MM-DD for the backend
			const formattedDate = format(date, "yyyy-MM-dd");
			onChange(formattedDate);
			setOpen(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"w-full justify-between font-normal",
						!selectedDate && "text-muted-foreground",
						error && "border-red-500 focus:border-red-500",
						className
					)}
					disabled={disabled}
				>
					{selectedDate ? format(selectedDate, "PPP") : placeholder}
					<ChevronDownIcon className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-auto overflow-hidden p-0"
				align="start"
			>
				<Calendar
					mode="single"
					selected={selectedDate}
					captionLayout="dropdown"
					onSelect={handleSelect}
				/>
			</PopoverContent>
		</Popover>
	);
}
