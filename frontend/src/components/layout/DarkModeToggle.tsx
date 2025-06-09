import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

const DarkModeToggle = () => {
	const toggleTheme = () => {
		// Toggle between light and dark
		// uiStore.setTheme(uiStore.theme === "dark" ? "light" : "dark");
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			aria-label="Toggle dark mode"
		>
			{/* {uiStore.theme === "dark" ? <Sun size={20} /> : <Moon size={20} />} */}
		</Button>
	);
};

export default DarkModeToggle;
