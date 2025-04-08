import { observer } from "mobx-react-lite";
import { useUIStore } from "@/stores/rootStore";
import { useEffect } from "react";
import { ThemeProvider } from "./ThemeProvider";

interface ThemeBridgeProps {
	children: React.ReactNode;
}

const ThemeBridge = observer(({ children }: ThemeBridgeProps) => {
	const uiStore = useUIStore();

	// Apply theme from UIStore on initial load
	useEffect(() => {
		uiStore.applyTheme();
	}, []);

	return (
		<ThemeProvider
			defaultTheme={uiStore.theme}
			// Connect Shadcn's theme changes to our UIStore
			onThemeChange={(theme) => uiStore.setTheme(theme)}
		>
			{children}
		</ThemeProvider>
	);
});

export default ThemeBridge;
