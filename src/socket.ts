import { io, Socket } from 'socket.io-client';
import type { Message, SimpleUser } from '@/types';
import { SOCKET_PATH, SOCKET_URL } from "@/config";

interface CanvasRes {
  status: string;
  prevAnswer: {
    answerTW: string;
    answerEN: string;
    answerJP: string;
  };
  correctRespondent: SimpleUser | null;
}

interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
  'server message': (msg: Message) => void;
  'server canvas': (data: CanvasRes) => void;
  'server ranking': (data: SimpleUser[]) => void;
}

interface ClientToServerEvents {
  hello: () => void;
  'client message': (msg: string) => void;
}

// interface InterServerEvents {
//   ping: () => void;
// }

// interface SocketData {
//   name: string;
//   age: number;
// }

const socketOptions = {
  path: SOCKET_PATH,
  forceNew: true,
  withCredentials: true,
  autoConnect: false,
};

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  SOCKET_URL ? io(SOCKET_URL, socketOptions) : io(socketOptions);
