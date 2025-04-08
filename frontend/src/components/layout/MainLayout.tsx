import { observer } from "mobx-react-lite";
import { Outlet } from "react-router";
import Header from "./Header";
import Sidebar from "./Sidebar";

const MainLayout = observer(() => {
	return (
		<div className="flex h-screen bg-slate-100">
			<Sidebar />
			<div className="flex flex-col flex-1 overflow-hidden">
				<Header />
				<main className="flex-1 overflow-y-auto p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
});

export default MainLayout;
