import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {ClerkProvider} from "@clerk/clerk-react";
import {ThemeProvider} from "./contexts/ThemeContext";
import "./index.css";
import App from "./App.jsx";
import "./utils/iosViewportFix.js"; // iOS Safari viewport height fix

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>
);
