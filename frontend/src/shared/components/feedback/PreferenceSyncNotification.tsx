import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import { storage } from "@/shared/services/storage.service";

/**
 * Component to show one-time notification about preference synchronization
 */
export const PreferenceSyncNotification: React.FC = () => {
	const [hasShownNotification, setHasShownNotification] = useState(false);

	useEffect(() => {
		const checkAndShowNotification = () => {
			const NOTIFICATION_KEY = "preference-sync-notification-shown";
			const hasShown = storage.getItem<boolean>(NOTIFICATION_KEY);

			if (!hasShown && !hasShownNotification) {
				// Show notification about new preference sync feature
				toast.info(
					"Your preferences are now synced across devices! Theme, loader style, and search settings will be remembered when you log in from any device.",
					{
						duration: 8000, // Show for 8 seconds
						action: {
							label: "Got it",
							onClick: () => {
								// User acknowledged the notification
								logger.info(
									"User acknowledged preference sync notification"
								);
							},
						},
					}
				);

				// Mark notification as shown
				storage.setItem(NOTIFICATION_KEY, true);
				setHasShownNotification(true);

				logger.info("Preference sync notification shown to user");
			}
		};

		// Show notification after a short delay to avoid overwhelming the user on login
		const timer = setTimeout(checkAndShowNotification, 2000);

		return () => clearTimeout(timer);
	}, [hasShownNotification]);

	// This component doesn't render anything visible
	return null;
};

/**
 * Hook to show sync status indicators
 */
export const useSyncStatus = () => {
	const [isSyncing, setIsSyncing] = useState(false);
	const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

	const showSyncInProgress = () => {
		setIsSyncing(true);
		// Auto-hide after 2 seconds
		setTimeout(() => setIsSyncing(false), 2000);
	};

	const showSyncComplete = () => {
		setLastSyncTime(new Date());
		setIsSyncing(false);
	};

	const showSyncError = (error: string) => {
		setIsSyncing(false);
		toast.error(`Sync failed: ${error}. Changes saved locally.`, {
			duration: 4000,
		});
	};

	return {
		isSyncing,
		lastSyncTime,
		showSyncInProgress,
		showSyncComplete,
		showSyncError,
	};
};
