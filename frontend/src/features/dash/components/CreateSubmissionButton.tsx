import { cn } from "@/shared/utils";
import "./TestTubeButton.css";

const TubeSVG = () => {
	return (
		<svg
			className="tube-svg"
			viewBox="0 0 32 32"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			{" "}
			<defs>
				{" "}
				<linearGradient
					id="tubeGrad"
					x1="0%"
					y1="0%"
					x2="100%"
					y2="100%"
				>
					{" "}
					<stop offset="0%" style={{ stopColor: "#fefefe" }} />{" "}
					<stop offset="50%" style={{ stopColor: "#f8fafc" }} />{" "}
					<stop offset="100%" style={{ stopColor: "#e2e8f0" }} />{" "}
				</linearGradient>{" "}
				<radialGradient id="liquidGrad" cx="40%" cy="20%">
					{" "}
					<stop offset="0%" style={{ stopColor: "#4ade80" }} />{" "}
					<stop offset="60%" style={{ stopColor: "#22c55e" }} />{" "}
					<stop offset="100%" style={{ stopColor: "#15803d" }} />{" "}
				</radialGradient>{" "}
			</defs>{" "}
			<path
				d="M12 3 L12 10 L9 13 L9 26 C9 27.7 10.3 29 12 29 L20 29 C21.7 29 23 27.7 23 26 L23 13 L20 10 L20 3 Z"
				fill="url(#tubeGrad)"
				stroke="#475569"
				strokeWidth="1"
			/>{" "}
			<rect
				x="10.5"
				y="15"
				width="11"
				height="12"
				rx="1.5"
				fill="url(#liquidGrad)"
			/>{" "}
			<circle cx="13" cy="19" r="1.2" fill="#a7f3d0" opacity="0.9" />{" "}
			<circle cx="17" cy="22" r="1.8" fill="#6ee7b7" opacity="0.8" />{" "}
			<path
				d="M13.5 4 L13.5 8 L12 10 L12 22"
				fill="none"
				stroke="rgba(255,255,255,0.9)"
				strokeWidth="2"
			/>{" "}
		</svg>
	);
};

const CreateSubmissionButton = () => {
	return (
		<div
			className={cn(
				"test-tube-button",
				"cursor-pointer p-4 rounded-lg",
				"drop-shadow-lg",
				"dark-foreground-card light-submission-button",
				"-mb-2"
			)}
		>
			<div className="relative flex items-center w-full justify-center gap-2">
				<div className="tube-container">
					<TubeSVG />
				</div>
				<div className="text-lg text-white dark:text-white md:text-2xl font-bold text-center">
					<span>New Submission</span>
				</div>
			</div>
		</div>
	);
};

export default CreateSubmissionButton;
