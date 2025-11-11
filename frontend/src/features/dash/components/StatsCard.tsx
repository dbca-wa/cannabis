import { useEffect, useState, useRef, type ReactNode } from "react";
import "./Stats.css";
import { cn } from "@/shared";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export interface IStatCard {
	title: string;
	toolTip: string;
	yearlyChange: number;
	monthlyChange: number;
	amount: number;
	amountDenomination: amountDenomination;
	icon: ReactNode;
	iconBGColour?: string;
	iconColour?: string;
}

type amountDenomination = "dollar" | "percent" | "none";

interface IStatComparer {
	changeAmount: number;
	type: "yearly" | "monthly";
}

const StatComparer = ({ changeAmount, type }: IStatComparer) => {
	const [changeValue, setChangeValue] = useState<number>(0);
	const animationRef = useRef<number>(0);

	/*
        Runs the animation for incrementing or decrementing change value
    */
	const runAnimation = () => {
		const startTime = performance.now();
		const duration = 1500; // 1.5 seconds
		const startValue = 0;
		const endValue = changeAmount;
		const difference = endValue - startValue;

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function for smooth animation
			const easeOutQuart = 1 - Math.pow(1 - progress, 4);
			const current = startValue + difference * easeOutQuart;

			setChangeValue(current);

			if (progress < 1) {
				animationRef.current = requestAnimationFrame(animate);
			}
		};

		animationRef.current = requestAnimationFrame(animate);
	};

	/*
        Calculates the colour of the stat comparer based on 
        whether change is negative or positive
    */
	const calculateColour = () => {
		return changeAmount >= 0 ? "stat-pos" : "stat-neg";
	};

	// Run calculations on mount
	useEffect(() => {
		// Start animation after a delay based on type
		const delay = type === "yearly" ? 1000 : 1200;
		const timer = setTimeout(() => {
			runAnimation();
		}, delay);

		return () => {
			clearTimeout(timer);
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [changeAmount, type]);

	const formatValue = (value: number) => {
		const sign = changeAmount >= 0 ? "+" : "";
		return `${sign}${value.toFixed(1)}%`;
	};

	const getArrow = () => {
		return changeAmount >= 0 ? "↗" : "↘";
	};

	return (
		<div className={cn("stat-change", calculateColour())}>
			<span className="change-arrow">{getArrow()}</span>
			<span>{formatValue(changeValue)}</span>
			<span className="change-label">
				vs last {type === "yearly" ? "year" : "month"}
			</span>
		</div>
	);
};

const StatsCard = ({
	title,
	toolTip,
	monthlyChange,
	yearlyChange,
	amount,
	amountDenomination,
	icon,
	iconBGColour,
	iconColour,
}: IStatCard) => {
	const [displayAmount, setDisplayAmount] = useState<number>(0);
	const animationRef = useRef<number>(0);

	const runAnimation = () => {
		const startTime = performance.now();
		const duration = 2000; // 2 seconds
		const startValue = 0;
		const endValue = amount;
		const difference = endValue - startValue;

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function for smooth animation
			const easeOutQuart = 1 - Math.pow(1 - progress, 4);
			const current = startValue + difference * easeOutQuart;

			setDisplayAmount(current);

			if (progress < 1) {
				animationRef.current = requestAnimationFrame(animate);
			}
		};

		animationRef.current = requestAnimationFrame(animate);
	};

	const formatAmount = (value: number) => {
		if (amountDenomination === "dollar") {
			return `$${Math.round(value).toLocaleString()}`;
		} else if (amountDenomination === "percent") {
			return `${value.toFixed(1)}%`;
		} else {
			return Math.round(value).toLocaleString();
		}
	};

	useEffect(() => {
		// Start animation after a short delay
		const timer = setTimeout(() => {
			runAnimation();
		}, 300);

		return () => {
			clearTimeout(timer);
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [amount]);

	return (
		<Tooltip>
			<TooltipTrigger>
				<div className="dark-foreground-card light-stats-card w-full">
					<div className="stat-top-section">
						<span className="stat-title">{title}</span>
						<div
							className={cn(
								"stat-icon-container",
								iconBGColour ? iconBGColour : "default-icon-bg",
								iconColour ? iconColour : "default-icon-colour"
							)}
						>
							{icon}
						</div>
					</div>
					<div className="stat-amount-section">
						<span>{formatAmount(displayAmount)}</span>
					</div>
					<div className="stat-bottom-section">
						<StatComparer
							type="monthly"
							changeAmount={monthlyChange}
						/>
						<StatComparer
							type="yearly"
							changeAmount={yearlyChange}
						/>
					</div>
				</div>
			</TooltipTrigger>
			<TooltipContent>
				<span>{toolTip}</span>
			</TooltipContent>
		</Tooltip>
	);
};

export default StatsCard;
