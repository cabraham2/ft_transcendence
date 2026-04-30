import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_BASE_URL ?? window.location.origin;

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(WS_URL, {
    transports: ['websocket'],
    auth: { token },
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
