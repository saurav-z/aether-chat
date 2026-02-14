import { useNotification } from '../contexts/NotificationContext';

/**
 * Example usage of the notification system
 * Import useNotification hook and call methods to show notifications
 */
export function useNotificationExamples() {
  const { addNotification, dismissNotification, markAsSeen, clearAll, getUnreadCount } = useNotification();

  // Success notification
  const showSuccess = (message: string) => {
    addNotification(message, 'success', { duration: 4000 });
  };

  // Error notification (stays until dismissed)
  const showError = (message: string) => {
    addNotification(message, 'error', { dismissible: true });
  };

  // Info notification
  const showInfo = (message: string) => {
    addNotification(message, 'info', { duration: 5000 });
  };

  // Warning notification
  const showWarning = (message: string) => {
    addNotification(message, 'warning', { duration: 6000 });
  };

  // Get unread count
  const unreadCount = getUnreadCount();

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    unreadCount,
    dismissNotification,
    markAsSeen,
    clearAll,
  };
}
