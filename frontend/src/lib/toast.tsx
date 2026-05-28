import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "danger" | "warn";

export type Toast = {
  id: string;
  title: string;
  body?: string;
  variant: ToastVariant;
  ttl: number;
};

type ToastInput = Omit<Toast, "id" | "ttl"> & { ttl?: number };

type ToastContextValue = {
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);
const DEFAULT_TTL = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const toast: Toast = { id, ttl: t.ttl ?? DEFAULT_TTL, ...t };
      setToasts((list) => [...list, toast]);
      const timer = setTimeout(() => dismiss(id), toast.ttl);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`}>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.body && <div className="toast-text">{t.body}</div>}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
