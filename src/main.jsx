import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {ThemeProvider} from "./contexts/ThemeContext";
import "./inter.css";
import "./index.css";
import "./neobrutalism.css";
import App from "./App.jsx";
import "./utils/iosViewportFix.js";
import {AuthProvider} from "./auth/client";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
