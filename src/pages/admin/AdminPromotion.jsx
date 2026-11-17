import {Navigate, useParams} from "react-router-dom";

// Advance (promotion) now lives in the Live Director station's Advance panel
// (src/pages/admin/live/panels/AdvancePanel.jsx).
export default function AdminPromotion() {
    const {id} = useParams();
    return <Navigate to={`/admin?round=${encodeURIComponent(id || "")}&station=director&panel=advance`} replace />;
}
