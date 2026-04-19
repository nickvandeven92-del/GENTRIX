import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.PROD) {
  void import("virtual:pwa-register").then((m) => {
    m.registerSW({ immediate: true });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
