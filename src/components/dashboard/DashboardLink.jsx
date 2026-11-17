import {Link} from "react-router-dom";
import {preloadDashboardRoute} from "../../lib/dashboardRoutes";

export default function DashboardLink({to, onFocus, onPointerEnter, ...props}) {
  return (
    <Link
      {...props}
      to={to}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) preloadDashboardRoute(to);
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented && event.pointerType !== "touch") preloadDashboardRoute(to);
      }}
    />
  );
}
