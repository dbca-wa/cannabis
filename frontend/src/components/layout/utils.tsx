import { FileText, Home, Settings, Users } from "lucide-react";

export const REGULAR_SIDEBAR_ITEMS = [
	{
		name: "Home",
		icon: <Home size={20} />,
		activeIcon: <Home size={20} />,
		adminOnly: false,
	},
	{
		name: "Users",
		icon: <Users size={20} />,
		activeIcon: <Users size={20} />,
		adminOnly: false,
	},
	{
		name: "Submissions",
		icon: <FileText size={20} />,
		activeIcon: <FileText size={20} />,
		adminOnly: false,
	},
	{
		name: "Admin",
		icon: <Settings size={20} />,
		activeIcon: <Settings size={20} />,
		adminOnly: true,
	},
];
