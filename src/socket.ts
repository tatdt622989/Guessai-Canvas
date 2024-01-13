import { io, Socket } from 'socket.io-client';
import type { Message } from '@/types';

interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
  'server message': (msg: Message) => void;
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

const URL = process.env.NODE_ENV === 'production' ? 'https://api.6yuwei.com/' : 'http://localhost:3001/';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
    withCredentials: true,
});