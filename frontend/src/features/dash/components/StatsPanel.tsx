import { TestTube } from "lucide-react";
import StatsCard, { type IStatCard } from "./StatsCard";
import { FaMoneyBill } from "react-icons/fa6";
import "./Stats.css";
import { FcDocument } from "react-icons/fc";

const StatsPanel = () => {
	const revenueDummyData: IStatCard = {
		title: "Monthly Revenue",
		toolTip: "Total monthly revenue",
		amount: 20000,
		amountDenomination: "dollar",
		monthlyChange: 28,
		yearlyChange: -20,
		icon: <FaMoneyBill />,
		iconBGColour: "bg-green-900/30",
		iconColour: "text-green-500",
	};

	const mySubmissionsDummyData: IStatCard = {
		title: "My Submissions",
		toolTip: "Submissions you have been involved in",
		amount: 200,
		amountDenomination: "none",
		monthlyChange: 28,
		yearlyChange: -20,
		icon: <TestTube />,
		iconBGColour: "bg-blue-900/30",
		iconColour: "text-blue-500",
	};

	const certificatesIssuedDummyData: IStatCard = {
		title: "Certificates Issued",
		toolTip: "Total certificates issued",
		amount: 200,
		amountDenomination: "none",
		monthlyChange: 28,
		yearlyChange: -20,
		icon: <FcDocument />,
		iconBGColour: "bg-purple-900/30",
		iconColour: "text-purple-500",
	};

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<StatsCard {...mySubmissionsDummyData} />
			<StatsCard {...certificatesIssuedDummyData} />
			<StatsCard {...revenueDummyData} />
		</div>
	);
};

export default StatsPanel;
