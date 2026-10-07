import {useLayoutEffect, useRef} from "react";
import {motion as Motion} from "framer-motion";
import {cn} from "../../lib/utils";

const MotionDialog = Motion.create("dialog");

/** Native modality supplies focus containment, background inertness and focus return. */
export default function ModalSurface({children, className, onDismiss, drawer = false, initialFocus, ...props}) {
  const dialogRef = useRef(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    if (initialFocus) dialog.querySelector(initialFocus)?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [initialFocus]);

  return (
    <MotionDialog
      {...props}
      ref={dialogRef}
      className={cn("axiom-dialog", drawer && "axiom-dialog--drawer", className)}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!drawer || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          onDismiss();
        }
      }}
    >
      {children}
    </MotionDialog>
  );
}
