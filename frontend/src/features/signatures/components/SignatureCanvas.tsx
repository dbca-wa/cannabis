/**
 * Canvas-based signature drawing pad.
 * Uses a fixed internal resolution and CSS scaling so the exported
 * PNG is always a consistent size regardless of display dimensions.
 */

import { useCallback, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";
import { useUploadSignature } from "../hooks";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;
const STROKE_COLOUR = "#1a1a1a";
const LINE_WIDTH = 2.5;

interface SignatureCanvasProps {
	onConfirm?: () => void;
}

export const SignatureCanvas = ({ onConfirm }: SignatureCanvasProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const isDrawing = useRef(false);
	const [hasDrawn, setHasDrawn] = useState(false);
	const uploadMutation = useUploadSignature();

	const getContext = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return null;
		return canvas.getContext("2d");
	}, []);

	const configureStroke = useCallback((ctx: CanvasRenderingContext2D) => {
		ctx.strokeStyle = STROKE_COLOUR;
		ctx.lineWidth = LINE_WIDTH;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
	}, []);

	/** Scale pointer coordinates from CSS display size to canvas resolution. */
	const getPointerPosition = useCallback(
		(event: React.PointerEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return { x: 0, y: 0 };
			const rect = canvas.getBoundingClientRect();
			return {
				x: (event.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
				y: (event.clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
			};
		},
		[]
	);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLCanvasElement>) => {
			const ctx = getContext();
			if (!ctx) return;
			isDrawing.current = true;
			canvasRef.current?.setPointerCapture(event.pointerId);
			const { x, y } = getPointerPosition(event);
			configureStroke(ctx);
			ctx.beginPath();
			ctx.moveTo(x, y);
		},
		[getContext, getPointerPosition, configureStroke]
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLCanvasElement>) => {
			if (!isDrawing.current) return;
			const ctx = getContext();
			if (!ctx) return;
			const { x, y } = getPointerPosition(event);
			ctx.lineTo(x, y);
			ctx.stroke();
			setHasDrawn(true);
		},
		[getContext, getPointerPosition]
	);

	const handlePointerUp = useCallback(
		(event: React.PointerEvent<HTMLCanvasElement>) => {
			if (!isDrawing.current) return;
			isDrawing.current = false;
			canvasRef.current?.releasePointerCapture(event.pointerId);
		},
		[]
	);

	const handleClear = useCallback(() => {
		const ctx = getContext();
		if (!ctx) return;
		ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		setHasDrawn(false);
	}, [getContext]);

	/** Export the full canvas as a PNG and upload it. */
	const handleConfirm = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas || !hasDrawn) return;

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/png")
		);
		if (!blob) return;

		const formData = new FormData();
		formData.append("image", blob, "signature.png");

		try {
			await uploadMutation.mutateAsync(formData);
			handleClear();
			onConfirm?.();
		} catch {
			// Mutation hook handles toast errors
		}
	}, [hasDrawn, uploadMutation, handleClear, onConfirm]);

	return (
		<div className="space-y-3">
			<canvas
				ref={canvasRef}
				width={CANVAS_WIDTH}
				height={CANVAS_HEIGHT}
				role="img"
				aria-label="Signature drawing canvas"
				className="w-full rounded-xl border border-input bg-white"
				style={{
					touchAction: "none",
					cursor:
						"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/%3E%3C/svg%3E\") 2 22, crosshair",
				}}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
			/>
			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={handleClear}
					disabled={!hasDrawn || uploadMutation.isPending}
				>
					Clear
				</Button>
				<Button
					type="button"
					onClick={handleConfirm}
					disabled={!hasDrawn || uploadMutation.isPending}
					className="bg-emerald-600 hover:bg-emerald-700 text-white"
				>
					{uploadMutation.isPending && (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					)}
					{uploadMutation.isPending ? "Submitting…" : "Confirm"}
				</Button>
			</div>
		</div>
	);
};
