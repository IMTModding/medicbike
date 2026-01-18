import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { FatalErrorFallback } from "@/components/FatalErrorFallback";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root introuvable dans index.html");
}

const root = createRoot(rootEl);

// If a crash happens before React can show anything, render a readable error.
function renderFatal(error: unknown) {
  try {
    root.render(<FatalErrorFallback error={error} />);
  } catch {
    // Last resort: avoid a blank page.
    rootEl.innerHTML = "<pre style='padding:16px'>Erreur de démarrage.</pre>";
  }
}

window.addEventListener("error", (e) => {
  // Avoid infinite loops if React is already rendering.
  (window as any).__MEDICBIKE_BOOT_ERROR__ = e.error || e.message;
});
window.addEventListener("unhandledrejection", (e) => {
  (window as any).__MEDICBIKE_BOOT_ERROR__ = (e as PromiseRejectionEvent).reason;
});

try {
  root.render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </ThemeProvider>
  );
} catch (e) {
  renderFatal(e);
}

