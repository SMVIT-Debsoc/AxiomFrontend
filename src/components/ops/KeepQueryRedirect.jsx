import {Navigate, useLocation, useParams} from "react-router-dom";

/**
 * Redirect for retired admin URLs that keeps the current query (?event=, ?round=)
 * and adds the target's own params. `to` may use ":param" placeholders.
 *   <KeepQueryRedirect to="/admin/setup/:id" />
 *   <KeepQueryRedirect to="/admin/people?tab=registry" />
 */
export default function KeepQueryRedirect({to}) {
  const params = useParams();
  const location = useLocation();
  const [rawPath, rawSearch = ""] = to.split("?");
  const pathname = rawPath.replace(/:([A-Za-z_]+)/g, (_, key) => encodeURIComponent(params[key] ?? ""));
  const search = new URLSearchParams(location.search);
  new URLSearchParams(rawSearch).forEach((value, key) => search.set(key, value));
  const query = search.toString();
  return <Navigate replace to={{pathname, search: query ? `?${query}` : ""}} />;
}
