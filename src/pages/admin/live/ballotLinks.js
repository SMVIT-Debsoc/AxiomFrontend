import {useCallback, useEffect, useRef, useState} from "react";
import QRCode from "qrcode";
import {useAuth} from "../../../auth/client.jsx";
import {OpsApi} from "../../../services/api";
import {absoluteUrl, normalizeBallotLinks} from "../../../lib/liveStations";

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

/** Ballot links for a round, keyed by debateId. `load()` is lazy; call it when needed. */
export function useBallotLinks(roundId, {auto = false} = {}) {
    const {getToken} = useAuth();
    const [state, setState] = useState({roundId: null, links: [], byDebate: new Map(), loading: false, error: null});
    const tokenRef = useRef(getToken);
    useEffect(() => { tokenRef.current = getToken; }, [getToken]);

    const load = useCallback(async () => {
        if (!roundId) return;
        setState((s) => ({...s, loading: true, error: null}));
        try {
            const token = await tokenRef.current();
            const res = await OpsApi.getBallotLinks(roundId, token);
            const links = normalizeBallotLinks(res, origin()).map((l) => ({...l, url: absoluteUrl(origin(), l.path)}));
            setState({roundId, links, byDebate: new Map(links.map((l) => [l.debateId, l])), loading: false, error: null});
        } catch (err) {
            setState((s) => ({...s, loading: false, error: err?.message || "Could not load ballot links"}));
        }
    }, [roundId]);

    useEffect(() => {
        if (!auto || !roundId) return;
        void load();
    }, [auto, roundId, load]);

    const current = state.roundId === roundId ? state : {links: [], byDebate: new Map(), loading: state.loading, error: state.error};
    return {...current, load};
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

/** Print-friendly room cards (room name, debaters, ballot QR) in a new window. */
export async function printRoomCards(links, {title = "Ballot room cards"} = {}) {
    const win = window.open("", "_blank");
    if (!win) return false;
    win.document.write(`<!doctype html><title>${esc(title)}</title><p style="font-family:sans-serif">Preparing cards…</p>`);
    const cards = await Promise.all(links.map(async (l) => ({
        ...l,
        qr: await QRCode.toDataURL(l.url, {margin: 1, width: 360, errorCorrectionLevel: "M"}),
    })));
    const body = cards.map((c) => `
      <section class="card">
        <h2>${esc(c.roomName || "Room")}</h2>
        <p class="vs"><b>GOV</b> ${esc(c.debater1Name)}<br><b>OPP</b> ${esc(c.debater2Name)}</p>
        ${c.judgeName ? `<p class="judge">Judge: ${esc(c.judgeName)}</p>` : ""}
        <img src="${c.qr}" alt="Ballot QR for ${esc(c.roomName)}">
        <p class="hint">Judge: scan to submit the ballot</p>
      </section>`).join("");
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        body{font-family:"League Spartan",Inter,system-ui,sans-serif;margin:0;color:#1D1E18}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0}
        .card{box-sizing:border-box;height:50vh;padding:24px;border:1px dashed #999;text-align:center;page-break-inside:avoid;display:flex;flex-direction:column;align-items:center;justify-content:center}
        h2{font-family:"Bebas Neue",sans-serif;font-size:44px;margin:0 0 8px;font-weight:400}
        .vs{font-size:16px;margin:0 0 6px;line-height:1.4}.judge{font-size:13px;margin:0 0 8px;color:#444}
        img{width:200px;height:200px}.hint{font-size:12px;color:#555;margin:6px 0 0}
        @media print{.card{height:48vh}}
      </style></head><body><div class="grid">${body}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},150)}${"<"}/script></body></html>`);
    win.document.close();
    return true;
}
