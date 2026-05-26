export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8081",
  wsUrl: import.meta.env.VITE_WS_URL ?? "ws://localhost:8080",
};
