import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

interface CountUpProps {
	to: number;
	duration?: number;
	prefix?: string;
	suffix?: string;
	decimals?: number;
}

/** Animated number counter that transitions from 0 to the target value. */
export const CountUp = ({
	to,
	duration = 1.2,
	prefix = "",
	suffix = "",
	decimals = 0,
}: CountUpProps) => {
	const [value, setValue] = useState(0);
	const started = useRef(false);

	useEffect(() => {
		// Skip animation for zero or negative values
		if (to <= 0) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setValue(to);
			return;
		}

		if (started.current) return;
		started.current = true;

		const controls = animate(0, to, {
			duration,
			ease: [0.22, 1, 0.36, 1],
			onUpdate: (v) => setValue(v),
		});

		return () => controls.stop();
	}, [to, duration]);

	return (
		<span className="tabular-nums">
			{prefix}
			{value.toLocaleString(undefined, {
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
			})}
			{suffix}
		</span>
	);
};
