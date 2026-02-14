import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';
export type NotificationStatus = 'unread' | 'seen';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  timestamp: number;
  duration?: number; // Optional: auto-dismiss in milliseconds
  dismissible?: boolean; // Allow user to dismiss
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: NotificationType, options?: { duration?: number; dismissible?: boolean }) => string;
  dismissNotification: (id: string) => void;
  markAsSeen: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, type: NotificationType, options?: { duration?: number; dismissible?: boolean }) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const notification: Notification = {
        id,
        message,
        type,
        status: 'unread',
        timestamp: Date.now(),
        duration: options?.duration,
        dismissible: options?.dismissible ?? true,
      };

      setNotifications((prev) => [notification, ...prev]);

      // Auto-dismiss if duration is specified
      if (options?.duration) {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, options.duration);
      }

      return id;
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAsSeen = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'seen' as const } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const getUnreadCount = useCallback(() => {
    return notifications.filter((n) => n.status === 'unread').length;
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        dismissNotification,
        markAsSeen,
        clearAll,
        getUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
