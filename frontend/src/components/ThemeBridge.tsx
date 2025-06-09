import { useEffect } from "react";
import { ThemeProvider } from "./ThemeProvider";

interface ThemeBridgeProps {
	children: React.ReactNode;
}

const ThemeBridge = ({ children }: ThemeBridgeProps) => {
	// const uiStore = useUIStore();

	// Apply theme from UIStore on initial load
	useEffect(() => {
		// uiStore.applyTheme();
	}, []);

	return (
		<ThemeProvider
			defaultTheme={
				"light"
				// uiStore.theme
			}
			// Connect Shadcn's theme changes to our UIStore
			onThemeChange={
				() => {}
				// (theme) => uiStore.setTheme(theme)
			}
		>
			{children}
		</ThemeProvider>
	);
};

export default ThemeBridge;
