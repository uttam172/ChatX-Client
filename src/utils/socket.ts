import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export const initiateSocketConnection = (token: string) => {
  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
  });
  console.log(`Connecting socket...`);
};

export const disconnectSocket = () => {
  console.log("Disconnecting socket...");
  if (socket) socket.disconnect();
};

export const getSocket = (): Socket | null => {
  return socket;
};
