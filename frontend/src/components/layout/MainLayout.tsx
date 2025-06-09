import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import HomeRouterSyncComponent from "@/lib/HomeRouterSync";

const MainLayout = () => {
	return (
		<div className="flex h-screen bg-slate-100">
			<HomeRouterSyncComponent />
			<Sidebar />
			<div className="flex flex-col flex-1 overflow-hidden">
				<main className="flex-1 overflow-y-auto p-6 text-black">
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default MainLayout;
