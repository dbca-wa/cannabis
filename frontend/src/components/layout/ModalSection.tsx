import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const ModalSection = ({
	title,
	children,
	className,
	isFirst,
	isLast,
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
	isFirst?: boolean;
	isLast?: boolean;
}) => {
	return (
		<div
			className={cn(
				"flex flex-col w-full h-full",
				className,
				isFirst ? "mb-3" : undefined,
				isLast ? "" : undefined
			)}
		>
			<div className=" items-center justify-between mb-3">
				<span className=" text-[14px] font-semibold flex-shrink-0">
					{title}
				</span>
				<Separator className="mt-2" />
			</div>
			{children}
		</div>
	);
};
