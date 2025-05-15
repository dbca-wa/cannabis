import { baseInstance } from "@/api/axiosInstance";
import { Button } from "@/components/ui/button";

const Home = () => {
	return (
		<div>
			<Button
				onClick={() => {
					baseInstance.get("sentry-debug");
				}}
			>
				Trigger Error
			</Button>
		</div>
	);
};

export default Home;
