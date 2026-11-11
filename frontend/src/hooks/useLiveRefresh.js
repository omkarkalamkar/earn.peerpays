import { useEffect, useRef } from 'react';
import { getSocket } from '../api/socket';

/**
 * Keeps data fresh even when live socket events are missed - e.g. the phone was
 * locked / the app was backgrounded while the other side acted (OTP relay), or the
 * websocket dropped and reconnected. Refetches on:
 *   - socket (re)connect
 *   - tab / installed-app becoming visible again
 *   - a lightweight polling interval as a final safety net
 */
export function useLiveRefresh(load, { interval = 12000 } = {}) {
  const savedLoad = useRef(load);
  savedLoad.current = load;

  useEffect(() => {
    const run = () => savedLoad.current && savedLoad.current();

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', run);

    const socket = getSocket();
    if (socket) {
      socket.on('connect', run);
      if (socket.io) socket.io.on('reconnect', run);
    }

    const id = interval ? setInterval(run, interval) : null;

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', run);
      if (socket) {
        socket.off('connect', run);
        if (socket.io) socket.io.off('reconnect', run);
      }
      if (id) clearInterval(id);
    };
  }, [interval]);
}
