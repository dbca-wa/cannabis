import { Toaster as Sonner } from "sonner";
import { useUIStore } from "@/app/providers/store.provider";
import { observer } from "mobx-react-lite";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = observer(({ ...props }: ToasterProps) => {
	const uiStore = useUIStore();
	const theme = uiStore.resolvedTheme === "dark" ? "dark" : "light";

	return (
		<Sonner
			theme={theme}
			className="toaster group"
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
					description: "group-[.toast]:text-muted-foreground",
					actionButton:
						"group-[.toast]:bg-emerald-600 group-[.toast]:text-white group-[.toast]:hover:bg-emerald-700",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
					success:
						"group-[.toaster]:!bg-emerald-50 group-[.toaster]:!text-emerald-900 group-[.toaster]:!border-emerald-200 dark:group-[.toaster]:!bg-emerald-950/60 dark:group-[.toaster]:!text-emerald-100 dark:group-[.toaster]:!border-emerald-800",
					error:
						"group-[.toaster]:!bg-red-50 group-[.toaster]:!text-red-900 group-[.toaster]:!border-red-200 dark:group-[.toaster]:!bg-red-950/60 dark:group-[.toaster]:!text-red-100 dark:group-[.toaster]:!border-red-800",
					warning:
						"group-[.toaster]:!bg-amber-50 group-[.toaster]:!text-amber-900 group-[.toaster]:!border-amber-200 dark:group-[.toaster]:!bg-amber-950/60 dark:group-[.toaster]:!text-amber-100 dark:group-[.toaster]:!border-amber-800",
					info: "group-[.toaster]:!bg-blue-50 group-[.toaster]:!text-blue-900 group-[.toaster]:!border-blue-200 dark:group-[.toaster]:!bg-blue-950/60 dark:group-[.toaster]:!text-blue-100 dark:group-[.toaster]:!border-blue-800",
				},
			}}
			{...props}
		/>
	);
});

export { Toaster };
