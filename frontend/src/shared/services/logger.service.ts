// Simple logger service - just console logging with basic context
export type LogLevel = "debug" | "info" | "warn" | "error" | "test";

interface LogContext {
	userId?: string | number;
	requestId?: string;
	src?: string; // Source file name
	[key: string]: unknown;
}

class LoggerService {
	private isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

	private getCallerInfo(): string | undefined {
		try {
			const stack = new Error().stack;
			if (!stack) return undefined;

			const lines = stack.split("\n");
			// Skip the first few lines (Error, getCallerInfo, formatMessage, and the logger method)
			for (let i = 4; i < lines.length; i++) {
				const line = lines[i];
				if ((line && line.includes(".tsx")) || line.includes(".ts")) {
					// Extract filename from the stack trace
					const match = line.match(/([^\/\\]+\.tsx?)/);
					if (match) {
						return match[1];
					}
				}
			}
			return undefined;
		} catch {
			return undefined;
		}
	}

	private formatTimestamp(): string {
		try {
			const now = new Date();

			const timeFormatter = new Intl.DateTimeFormat("en-AU", {
				timeZone: "Australia/Perth",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false,
			});

			const timeParts = timeFormatter.formatToParts(now);

			// Extract parts and format as HH:MM:SS AWST
			const hour =
				timeParts.find((part) => part.type === "hour")?.value || "00";
			const minute =
				timeParts.find((part) => part.type === "minute")?.value || "00";
			const second =
				timeParts.find((part) => part.type === "second")?.value || "00";

			return `${hour}:${minute}:${second} AWST`;
		} catch (error) {
			// Fallback to local timezone if Perth timezone fails
			try {
				const now = new Date();
				const timeFormatter = new Intl.DateTimeFormat("en-AU", {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					hour12: false,
				});

				const timeParts = timeFormatter.formatToParts(now);

				const hour =
					timeParts.find((part) => part.type === "hour")?.value ||
					"00";
				const minute =
					timeParts.find((part) => part.type === "minute")?.value ||
					"00";
				const second =
					timeParts.find((part) => part.type === "second")?.value ||
					"00";

				console.warn(
					"Logger: Perth timezone formatting failed, using local timezone"
				);
				return `${hour}:${minute}:${second} LOCAL`;
			} catch (fallbackError) {
				// Final fallback to ISO string if all formatting fails
				console.warn(
					"Logger: All timezone formatting failed, using ISO string"
				);
				return new Date().toISOString();
			}
		}
	}

	private formatContext(context?: LogContext): {
		hasContext: boolean;
		contextObject?: LogContext;
	} {
		if (!context || typeof context !== "object") {
			return { hasContext: false };
		}

		// Filter out undefined, null, or empty values
		const filteredContext: LogContext = {};
		let hasValidEntries = false;

		for (const [key, value] of Object.entries(context)) {
			if (value !== undefined && value !== null && value !== "") {
				filteredContext[key] = value;
				hasValidEntries = true;
			}
		}

		return {
			hasContext: hasValidEntries,
			contextObject: hasValidEntries ? filteredContext : undefined,
		};
	}

	private formatMessage(
		level: LogLevel,
		message: string,
		context?: LogContext
	): { formattedArgs: [string, string, string]; contextObject?: LogContext } {
		const timestamp = this.formatTimestamp();
		const callerFile = this.getCallerInfo();

		// Add source file to context if not already provided and we detected it
		const enhancedContext = { ...context };
		if (callerFile && !enhancedContext.src) {
			enhancedContext.src = callerFile;
		}

		const contextInfo = this.formatContext(enhancedContext);

		// Level-specific colors
		let headerStyle: string;
		switch (level) {
			case "error":
				headerStyle =
					"background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;"; // Red
				break;
			case "warn":
				headerStyle =
					"background: #d97706; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;"; // Yellow/Orange
				break;
			case "test":
				headerStyle =
					"background: #9333ea; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;"; // Purple
				break;
			case "info":
			case "debug":
			default:
				headerStyle =
					"background: #2563eb; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;"; // Blue
				break;
		}

		const messageStyle = "color: inherit;";
		const header = `${level.toUpperCase()} | ${timestamp}`;

		return {
			formattedArgs: [
				`%c${header}%c\n${message}`,
				headerStyle,
				messageStyle,
			],
			contextObject: contextInfo.hasContext
				? contextInfo.contextObject
				: undefined,
		};
	}

	debug(message: string, context?: LogContext): void {
		if (this.isDev) {
			const { formattedArgs, contextObject } = this.formatMessage(
				"debug",
				message,
				context
			);
			if (contextObject) {
				console.debug(...formattedArgs, contextObject);
			} else {
				console.debug(...formattedArgs);
			}
		}
	}

	info(message: string, context?: LogContext): void {
		const { formattedArgs, contextObject } = this.formatMessage(
			"info",
			message,
			context
		);
		if (contextObject) {
			console.info(...formattedArgs, contextObject);
		} else {
			console.info(...formattedArgs);
		}
	}

	warn(message: string, context?: LogContext): void {
		const { formattedArgs, contextObject } = this.formatMessage(
			"warn",
			message,
			context
		);
		if (contextObject) {
			console.warn(...formattedArgs, contextObject);
		} else {
			console.warn(...formattedArgs);
		}
	}

	error(message: string, context?: LogContext): void {
		const { formattedArgs, contextObject } = this.formatMessage(
			"error",
			message,
			context
		);
		if (contextObject) {
			console.error(...formattedArgs, contextObject);
		} else {
			console.error(...formattedArgs);
		}
	}

	test(message: string, context?: LogContext): void {
		const { formattedArgs, contextObject } = this.formatMessage(
			"test",
			message,
			context
		);
		if (contextObject) {
			console.log(...formattedArgs, contextObject);
		} else {
			console.log(...formattedArgs);
		}
	}
}

export const logger = new LoggerService();
