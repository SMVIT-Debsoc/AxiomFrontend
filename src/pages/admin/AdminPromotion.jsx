import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Search,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";
import { useToast } from "../../components/ui/Toast";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { cn } from "../../lib/utils";

export default function AdminPromotion() {
  const { id: roundId } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await AdminApi.getRoundPerformers(roundId, token);
      if (response.success) {
        setPerformers(response.performers || []);
        setResultsPublished(response.resultsPublished);
        
        // Initial selected users are those already promoted
        const promoted = new Set();
        response.performers.forEach(p => {
          if (p.isPromoted) promoted.add(p.userId);
        });
        setSelectedUsers(promoted);
      }
    } catch (error) {
      toast.error("Error", "Failed to fetch performers");
    } finally {
      setLoading(false);
    }
  }, [roundId, getToken, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTogglePromote = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSavePromotion = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const response = await AdminApi.promoteDebaters(roundId, Array.from(selectedUsers), token);
      if (response.success) {
        toast.success("Success", "Promotion status updated locally");
        await fetchData(); // Refresh data
      }
    } catch (error) {
      toast.error("Error", "Failed to update promotion");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishResults = async (published) => {
    setPublishing(true);
    try {
      const token = await getToken();
      const response = await AdminApi.publishResults(roundId, published, token);
      if (response.success) {
        setResultsPublished(published);
        toast.success(
          published ? "Results Published" : "Results Hidden",
          published ? "Users can now see their results on the dashboard" : "Results are now hidden from users"
        );
      }
    } catch (error) {
      toast.error("Error", "Failed to update publication status");
    } finally {
      setPublishing(false);
    }
  };

  const filteredPerformers = performers.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.college || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !performers.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-purple-500" /> Review & Promote
            </h1>
            <p className="text-muted-foreground mt-1">
              Select debaters to promote to the next round based on performance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSavePromotion}
            disabled={saving || loading}
            className="px-6 py-2.5 rounded-xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Selection
          </button>
          
          <button
            onClick={() => handlePublishResults(!resultsPublished)}
            disabled={publishing || loading}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              resultsPublished 
                ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" 
                : "bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/25"
            )}
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : resultsPublished ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {resultsPublished ? "Hide Results" : "Make Results Public"}
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-blue-500 mt-1" />
          <div>
            <h4 className="font-bold text-blue-500 uppercase text-[10px] tracking-widest mb-1">Status Summary</h4>
            <p className="text-sm text-blue-900/70 dark:text-blue-200/70">
              Users see <strong>ELIMINATED</strong> unless you select and save them as <strong>PROMOTED</strong>.
            </p>
          </div>
        </div>
        
        <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-6 flex flex-col justify-center">
            <h4 className="font-bold text-purple-500 uppercase text-[10px] tracking-widest mb-1">Selected for Promotion</h4>
            <p className="text-2xl font-black text-purple-600">{selectedUsers.size}</p>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 flex flex-col justify-center">
            <h4 className="font-bold text-amber-500 uppercase text-[10px] tracking-widest mb-1">Public Results</h4>
            <p className={cn("text-lg font-bold uppercase", resultsPublished ? "text-green-500" : "text-amber-500")}>
              {resultsPublished ? "Published (Visible to Users)" : "Draft (Admin Only)"}
            </p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Filter by name or college..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-transparent rounded-lg focus:bg-background focus:border-border outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sorted by Speaker Score</span>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 text-[10px] font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 text-left w-12">#</th>
                <th className="px-6 py-4 text-left">Debater</th>
                <th className="px-6 py-4 text-center">Outcome</th>
                <th className="px-6 py-4 text-center">Speaker Score</th>
                <th className="px-6 py-4 text-right">Promotion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPerformers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground italic">
                    No performers found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredPerformers.map((performer, index) => {
                  const isSelected = selectedUsers.has(performer.userId);
                  
                  return (
                    <tr 
                      key={performer.userId} 
                      className={cn(
                        "group transition-colors",
                        isSelected ? "bg-purple-500/5 hover:bg-purple-500/10" : "hover:bg-muted/20"
                      )}
                    >
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={performer} size="sm" />
                          <div>
                            <p className="font-bold text-sm">
                              {performer.firstName} {performer.lastName}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {performer.college || "No College"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                          performer.won ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {performer.won ? "Won Match" : "Lost Match"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-600 font-bold">
                          {performer.score.toFixed(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right px-10">
                        <button
                          onClick={() => handleTogglePromote(performer.userId)}
                          className={cn(
                            "relative w-12 h-6 rounded-full transition-colors outline-none",
                            isSelected ? "bg-purple-500" : "bg-muted"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                            isSelected ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
