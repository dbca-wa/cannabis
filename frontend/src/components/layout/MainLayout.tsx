import { observer } from "mobx-react-lite";
import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import HomeRouterSync from "@/lib/HomeRouterSync";

const MainLayout = observer(() => {
	return (
		<div className="flex h-screen bg-slate-100">
			<Sidebar />
			<HomeRouterSync />
			<div className="flex flex-col flex-1 overflow-hidden">
				<main className="flex-1 overflow-y-auto p-6 text-black">
					<Outlet />
				</main>
			</div>
		</div>
	);
});

export default MainLayout;
