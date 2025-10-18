import { createRoot, type Root } from "react-dom/client";
import "./main.css";
import "./loader.css";
import App from "./App";

// Extend the HTMLElement interface to include custom property
declare global {
	interface HTMLElement {
		_reactRoot?: Root;
	}
}

// Get the root element
const container = document.getElementById("root")!;

// Create root only once and store it
if (!container._reactRoot) {
	container._reactRoot = createRoot(container);
}

// Render the app
container._reactRoot.render(<App />);
