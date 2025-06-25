import { observer } from "mobx-react";
import { TbDashboardFilled } from "react-icons/tb";

const Home = observer(() => {
	return (
		<div className="space-y-6">
			{/* Title and Kind Filter */}
			<div className="flex justify-between items-center">
				<div className="flex gap-2 items-center">
					<div className="cannabis-green">
						<TbDashboardFilled size={30} />
					</div>
					<h1 className="text-3xl font-bold">Dashboard</h1>
				</div>
			</div>

			<div className="flex flex-col">
				<p>1. Submissions requiring review.</p>
				<p>2. Certificates ready for review.</p>
				<p>3. Certificates ready for printing.</p>
				<p>Email bump feature.</p>
				<p>pdf design block display.</p>
			</div>
		</div>
	);
});

export default Home;
