const API_URL: string = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const ROOT_PATH: string = import.meta.env.BASE_URL || "/";
const SOCKET_URL: string =
  import.meta.env.VITE_SOCKET_URL ||
  (API_URL.startsWith("http") ? new URL(API_URL).origin : "");
const SOCKET_PATH: string =
  import.meta.env.VITE_SOCKET_PATH ||
  `${API_URL.startsWith("http") ? new URL(API_URL).pathname : API_URL}/guessai_canvas/socket.io/`;

export { API_URL, ROOT_PATH, SOCKET_PATH, SOCKET_URL };
