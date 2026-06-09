import { Link } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { FileQuestion, Home } from "lucide-react";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/**
 * 404 Not Found page displayed for unmatched routes.
 * Standalone full-page view — does not use the sidebar layout.
 */
const NotFound = () => {
	useDocumentTitle("Page Not Found");

	return (
		<div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
			<div className="space-y-6 max-w-md">
				<div className="flex justify-center">
					<FileQuestion className="h-16 w-16 text-muted-foreground" />
				</div>

				<h1 className="text-7xl font-bold text-emerald-600">404</h1>

				<h2 className="text-2xl font-semibold text-foreground">
					Page not found
				</h2>

				<p className="text-muted-foreground">
					The page you&apos;re looking for doesn&apos;t exist or has been moved.
				</p>

				<Button asChild variant="default" size="lg" className="gap-2">
					<Link to="/">
						<Home className="h-4 w-4" />
						Back to Home
					</Link>
				</Button>
			</div>
		</div>
	);
};

export default NotFound;
