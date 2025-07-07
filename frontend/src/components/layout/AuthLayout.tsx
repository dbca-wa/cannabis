import { useAuthStore } from "@/stores/rootStore";
import { observer } from "mobx-react";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";

const AuthLayout = observer(() => {
	// const authStore = useAuthStore();
	// const navigate = useNavigate();

	// useEffect(() => {
	// 	if (authStore.isAuthenticated) {
	// 		navigate("/");
	// 	}
	// }, [authStore.isAuthenticated, navigate]);

	return (
		<div className="flex h-screen w-screen items-center justify-center bg-slate-100">
			<div className="w-full max-w-md p-8 space-y-8 rounded-lg">
				{/* bg-white shadow */}
				<Outlet />
			</div>
		</div>
	);
});

export default AuthLayout;
