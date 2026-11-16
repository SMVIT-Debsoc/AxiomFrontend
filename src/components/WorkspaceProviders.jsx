import {MotionConfig} from "framer-motion";
import {Outlet} from "react-router-dom";
import {ToastProvider} from "./ui/Toast";

export default function WorkspaceProviders() {
    return (
        <MotionConfig reducedMotion="user" transition={{duration: 0.24, ease: [0.22, 1, 0.36, 1]}}>
            <ToastProvider>
                <Outlet />
            </ToastProvider>
        </MotionConfig>
    );
}
