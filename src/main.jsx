import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {ThemeProvider} from "./contexts/ThemeContext";
import {MotionConfig} from "framer-motion";
import "./index.css";
import "./neobrutalism.css";
import App from "./App.jsx";
import "./utils/iosViewportFix.js";
import {AuthProvider} from "./auth/client";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <MotionConfig reducedMotion="user" transition={{duration: 0.24, ease: [0.22, 1, 0.36, 1]}}>
          <App />
        </MotionConfig>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
