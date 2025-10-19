import { useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useUIStore } from "@/app/providers/store.provider";
import { Palette, Check } from "lucide-react";
import { cn } from "@/shared/utils";
import { Separator } from "../ui/separator";

type LoaderOption = {
	id: "cook" | "base" | "minimal";
	name: string;
	// description: string;
	// icon: React.ReactNode;
	color: string;
};

const loaderOptions: LoaderOption[] = [
	{
		id: "minimal",
		name: "Minimal",
		// icon: <Minus className="h-4 w-4" />,
		color: "bg-gray-500",
	},
	{
		id: "base",
		name: "Cannabis (Sciency?)",
		// icon: <Leaf className="h-4 w-4" />,
		color: "bg-green-500",
	},
	{
		id: "cook",
		name: "Cooking (FUN?!)",
		// description: "Animated cooking scene",
		// icon: <ChefHat className="h-4 w-4" />,
		color: "bg-orange-500",
	},
];

export const LoaderToggle = observer(() => {
	const uiStore = useUIStore();
	const [isChanging, setIsChanging] = useState(false);

	const handleLoaderChange = async (
		loaderId: "cook" | "base" | "minimal"
	) => {
		if (loaderId === uiStore.currentLoader) return;

		setIsChanging(true);

		// Add a small delay for visual feedback
		setTimeout(() => {
			uiStore.setLoader(loaderId);
			setIsChanging(false);
		}, 200);
	};

	return (
		<div className="w-full space-y-3">
			<Separator />
			{/* Header */}
			<div className="flex items-center gap-2 text-sm font-medium">
				<Palette className="h-4 w-4" />
				<span>Loader Style</span>
			</div>

			{/* Loader Options */}
			<div className="space-y-2">
				{loaderOptions.map((option) => {
					const isSelected = uiStore.currentLoader === option.id;
					const isDisabled = isChanging;

					return (
						<Button
							key={option.id}
							variant="ghost"
							size="sm"
							disabled={isDisabled}
							onClick={() => handleLoaderChange(option.id)}
							className={cn(
								"w-full justify-start gap-3 h-auto p-3 transition-all duration-200",
								isSelected && "bg-accent border border-border",
								!isSelected && "hover:bg-accent/50",
								isDisabled && "opacity-50 cursor-not-allowed"
							)}
						>
							{/* Icon with color indicator */}
							{/* <div className="flex items-center gap-2">
								<div
									className={cn(
										"w-3 h-3 rounded-full",
										option.color
									)}
								/>
								{option.icon}
							</div> */}

							{/* Text content */}
							<div className="flex-1 text-left">
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">
										{option.name}
									</span>
									{isSelected && (
										<Check className="h-3 w-3 text-green-600" />
									)}
								</div>
								{/* <span className="text-xs text-muted-foreground">
									{option.description}
								</span> */}
							</div>
						</Button>
					);
				})}
			</div>

			{/* Current selection badge */}
			<div className="pt-2">
				<div className="text-xs text-muted-foreground">
					Current:
					<Badge variant="secondary" className="ml-2 text-xs">
						{
							loaderOptions.find(
								(opt) => opt.id === uiStore.currentLoader
							)?.name
						}
					</Badge>
				</div>
			</div>
		</div>
	);
});

// LoaderToggle.displayName = "LoaderToggle";
