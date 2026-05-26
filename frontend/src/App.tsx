import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.js";
import { Landing } from "./pages/Landing.js";
import { Login } from "./pages/Login.js";
import { Signup } from "./pages/Signup.js";
import { Trader } from "./pages/Trader.js";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
          <Route path="/app" element={<Private><Trader /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-shell">
      <div className="spinner" />
    </div>
  );
}

function Private({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "signedIn") return <Navigate to="/app" replace />;
  return <>{children}</>;
}
