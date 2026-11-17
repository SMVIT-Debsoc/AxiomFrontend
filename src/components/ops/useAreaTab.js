import {useSearchParams} from "react-router-dom";

/** Reads/writes ?tab=<key>; the first tab is the default and leaves the URL clean. */
export function useAreaTab(tabs, {aliases = {}} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const keys = tabs.map((t) => t.key);
  const resolved = aliases[raw] || raw;
  const active = keys.includes(resolved) ? resolved : keys[0];
  const setActive = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === keys[0]) next.delete("tab");
    else next.set("tab", key);
    setSearchParams(next, {replace: true});
  };
  return [active, setActive];
}
