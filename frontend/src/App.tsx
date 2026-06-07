import { RouterProvider } from "react-router";
import { RootProvider } from "./app/providers/root.providers";
import { router } from "./app/router";

const App = () => {
	return (
		<RootProvider>
			<RouterProvider router={router} />
		</RootProvider>
	);
};

export default App;
