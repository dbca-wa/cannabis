import { createRoot, type Root } from "react-dom/client";
import "./index.css";
import App from "./App";

// Extend the HTMLElement interface to include our custom property
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
