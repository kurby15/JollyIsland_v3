export type NotifRole = 'admin' | 'cashier' | 'both';
export type NotifType = 'warning' | 'info' | 'success' | 'error';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  role: NotifRole;
}

let notifications: Notification[] = [
  { id: 'n1', type: 'warning', title: 'Session Expiring', message: "Liam Smith's session expires in 12 minutes.", time: '3:18 PM', read: false, role: 'cashier' },
  { id: 'n2', type: 'error', title: 'Session Critical', message: "Noah Davis has only 5 minutes remaining.", time: '3:15 PM', read: false, role: 'cashier' },
  { id: 'n3', type: 'info', title: 'New Registration', message: 'Emma Johnson was registered with the 2-Hour Play package.', time: '2:15 PM', read: false, role: 'both' },
  { id: 'n4', type: 'warning', title: 'RFID Card Lost', message: 'RFID-006 has been marked as lost by cashier.', time: '2:00 PM', read: false, role: 'admin' },
  { id: 'n5', type: 'success', title: 'Backup Completed', message: 'Daily database backup completed successfully.', time: '1:00 PM', read: true, role: 'admin' },
  { id: 'n6', type: 'info', title: 'New RFID Card Added', message: 'Admin added RFID-011 to the system.', time: '12:30 PM', read: true, role: 'cashier' },
  { id: 'n7', type: 'success', title: 'Revenue Milestone', message: "Today's revenue has reached ₱5,000.", time: '12:00 PM', read: true, role: 'admin' },
];

const listeners: (() => void)[] = [];
function notify() { listeners.forEach(fn => fn()); }

export function getNotifications(role: 'admin' | 'cashier'): Notification[] {
  return notifications.filter(n => n.role === role || n.role === 'both');
}

export function getUnreadCount(role: 'admin' | 'cashier'): number {
  return getNotifications(role).filter(n => !n.read).length;
}

export function markAllRead(role: 'admin' | 'cashier') {
  notifications = notifications.map(n =>
    (n.role === role || n.role === 'both') ? { ...n, read: true } : n
  );
  notify();
}

export function markRead(id: string) {
  notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
  notify();
}

export function addNotification(notif: Omit<Notification, 'id' | 'read' | 'time'>) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  notifications = [{ ...notif, id: `n${Date.now()}`, read: false, time }, ...notifications];
  notify();
}

export function subscribeNotifications(fn: () => void) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}
