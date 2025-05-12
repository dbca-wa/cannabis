import { Outlet } from "react-router";

const AuthLayout = () => {
	return (
		<div className="flex h-screen w-screen items-center justify-center bg-slate-100">
			<div className="w-full max-w-md p-8 space-y-8 rounded-lg">
				{/* bg-white shadow */}
				<Outlet />
			</div>
		</div>
	);
};

export default AuthLayout;
