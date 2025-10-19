export interface LoaderProps {
	progress: number;
	message: string;
	isComplete: boolean;
	onComplete?: () => void;
}
