import {Navigate, useParams} from "react-router-dom";

// Round management now lives in the Live Director station.
// The draw/room modals moved to src/pages/admin/live/modals/.
export default function AdminRoundManagement() {
    const {id} = useParams();
    return <Navigate to={`/admin?round=${encodeURIComponent(id || "")}&station=director`} replace />;
}
