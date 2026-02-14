import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { Bell } from 'lucide-react';
import '../styles/notifications.css';

export function NotificationContainer() {
  const { getUnreadCount } = useNotification();
  const unreadCount = getUnreadCount();

  if (unreadCount === 0) return null;

  return (
    <div className="notification-container">
      <div className="notification-badge" title="Unread notifications">
        <Bell size={20} className="notification-badge-icon" />
        <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
      </div>
    </div>
  );
}
