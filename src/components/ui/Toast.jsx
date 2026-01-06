import {
    useState,
    useEffect,
    createContext,
    useContext,
    useCallback,
} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {CheckCircle, XCircle, AlertCircle, Info, X} from "lucide-react";
import {cn} from "../../lib/utils";

// Toast Context
const ToastContext = createContext(null);

// Toast types with their icons and styles
const toastConfig = {
    success: {
        icon: CheckCircle,
        className: "bg-green-500/10 border-green-500/20 text-green-500",
        iconClassName: "text-green-500",
    },
    error: {
        icon: XCircle,
        className: "bg-red-500/10 border-red-500/20 text-red-500",
        iconClassName: "text-red-500",
    },
    warning: {
        icon: AlertCircle,
        className: "bg-amber-500/10 border-amber-500/20 text-amber-500",
        iconClassName: "text-amber-500",
    },
    info: {
        icon: Info,
        className: "bg-blue-500/10 border-blue-500/20 text-blue-500",
        iconClassName: "text-blue-500",
    },
};

// Individual Toast Component
function ToastItem({
    id,
    type = "info",
    title,
    message,
    onClose,
    duration = 5000,
}) {
    const config = toastConfig[type] || toastConfig.info;
    const Icon = config.icon;

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose(id);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [id, duration, onClose]);

    return (
        <motion.div
            layout
            initial={{opacity: 0, y: -20, scale: 0.95}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -20, scale: 0.95}}
            transition={{duration: 0.2}}
            className={cn(
                "relative w-full max-w-sm rounded-xl border p-4 shadow-lg backdrop-blur-sm",
                config.className
            )}
        >
            <div className="flex items-start gap-3">
                <Icon
                    className={cn(
                        "w-5 h-5 mt-0.5 flex-shrink-0",
                        config.iconClassName
                    )}
                />
                <div className="flex-1 min-w-0">
                    {title && <p className="font-semibold text-sm">{title}</p>}
                    {message && (
                        <p
                            className={cn(
                                "text-sm",
                                title ? "mt-1 opacity-90" : ""
                            )}
                        >
                            {message}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => onClose(id)}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}

// Toast Container Component
function ToastContainer({toasts, removeToast}) {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem {...toast} onClose={removeToast} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// Toast Provider
export function ToastProvider({children}) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback(
        ({type = "info", title, message, duration = 5000}) => {
            const id = Date.now() + Math.random();
            setToasts((prev) => [
                ...prev,
                {id, type, title, message, duration},
            ]);
            return id;
        },
        []
    );

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const toast = useCallback(
        {
            success: (title, message, duration) =>
                addToast({type: "success", title, message, duration}),
            error: (title, message, duration) =>
                addToast({type: "error", title, message, duration}),
            warning: (title, message, duration) =>
                addToast({type: "warning", title, message, duration}),
            info: (title, message, duration) =>
                addToast({type: "info", title, message, duration}),
            custom: (options) => addToast(options),
            dismiss: (id) => removeToast(id),
            dismissAll: () => setToasts([]),
        },
        [addToast, removeToast]
    );

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

// Hook to use toast
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

export default ToastProvider;
