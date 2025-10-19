// Simple logger service - just console logging with basic context
export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	userId?: string | number;
	requestId?: string;
	[key: string]: unknown;
}

class LoggerService {
	private isDev = import.meta.env.DEV;

	private formatMessage(
		level: LogLevel,
		message: string,
		context?: LogContext
	): string {
		const timestamp = new Date().toISOString();
		let formatted = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

		if (context?.userId) formatted += ` (User: ${context.userId})`;
		if (context?.requestId) formatted += ` (Request: ${context.requestId})`;

		return formatted;
	}

	debug(message: string, context?: LogContext): void {
		if (this.isDev) {
			console.debug(
				this.formatMessage("debug", message, context),
				context
			);
		}
	}

	info(message: string, context?: LogContext): void {
		console.info(this.formatMessage("info", message, context), context);
	}

	warn(message: string, context?: LogContext): void {
		console.warn(this.formatMessage("warn", message, context), context);
	}

	error(message: string, context?: LogContext): void {
		console.error(this.formatMessage("error", message, context), context);
	}
}

export const logger = new LoggerService();
