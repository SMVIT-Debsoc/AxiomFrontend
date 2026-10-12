import {Analytics} from "@vercel/analytics/react";
import {useLocation} from "react-router-dom";
import {getAnalyticsPath} from "../../utils/analyticsPath";

export function VercelAnalytics() {
    const {pathname} = useLocation();
    const safePath = getAnalyticsPath(pathname);

    return <Analytics route={safePath} path={safePath} />;
}
