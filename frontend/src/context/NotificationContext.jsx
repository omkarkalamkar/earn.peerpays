import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from './AuthContext';
import { playChime } from '../sound';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((message, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const load = useCallback(() => {
    api.get('/notifications').then((res) => setNotifications(res.data.notifications));
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const socket = getSocket();
    if (!socket) return;
    const onNotification = (n) => {
      setNotifications((list) => [n, ...list]);
      pushToast(n.message, 'info');
      playChime();
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, [user, load, pushToast]);

  async function markAllRead() {
    await api.post('/notifications/read-all');
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unread, markAllRead, pushToast, reload: load }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-[fadeIn_0.2s] rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg max-w-xs"
          >
            {t.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
