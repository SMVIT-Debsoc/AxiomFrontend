import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  Trophy,
  Search,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";
import {useToast} from "../../hooks/useToast"
import { UserAvatar } from "../../components/ui/UserAvatar";
import { cn } from "../../lib/utils";
import LoadingIndicator from "../../components/ui/LoadingIndicator";

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
        response.performers?.forEach(p => {
          if (p.isPromoted) promoted.add(p.userId);
        });
        setSelectedUsers(promoted);
      }
    } catch {
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
        toast.success("Success", "Promotion selection saved to server");
        await fetchData(); // Refresh data
      }
    } catch {
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
          published ? "Results Published!" : "Results Hidden",
          published ? "All debaters can now see their win/loss status on their dashboard." : "Final results are now hidden from debaters."
        );
      }
    } catch {
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
        <LoadingIndicator label="Loading debater performance standings" />
      </div>
    );
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="axiom-page-header flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            title="Go back"
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400">Progression Control</span>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-emerald-500" /> Review &amp; Promote
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select debaters to promote to the next round based on performance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSavePromotion}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Selection
          </button>
          
          <button
            type="button"
            onClick={() => handlePublishResults(!resultsPublished)}
            disabled={publishing || loading}
            className={cn(
              "px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              resultsPublished 
                ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20" 
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
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

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-5 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-blue-600 dark:text-blue-400 uppercase text-[10px] tracking-wider mb-1">Status Summary</h4>
            <p className="text-xs text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
              Users see <strong>ELIMINATED</strong> unless you select and save them as <strong>PROMOTED</strong>.
            </p>
          </div>
        </div>
        
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 flex flex-col justify-center">
          <h4 className="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[10px] tracking-wider mb-1">Selected for Promotion</h4>
          <p className="text-2xl font-black font-heading text-emerald-600 dark:text-emerald-400">{selectedUsers.size}</p>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-5 flex flex-col justify-center">
          <h4 className="font-bold text-amber-600 dark:text-amber-400 uppercase text-[10px] tracking-wider mb-1">Public Results</h4>
          <p className={cn("text-base font-bold uppercase tracking-wide", resultsPublished ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
            {resultsPublished ? "Published (Visible to Users)" : "Draft (Admin Only)"}
          </p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-none">
        <div className="p-4 border-b border-border bg-card flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Filter by debater name or college..."
              aria-label="Filter debaters by name or college"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-lg focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sorted by Speaker Score</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 text-left w-12">#</th>
                <th scope="col" className="px-6 py-4 text-left">Debater</th>
                <th scope="col" className="px-6 py-4 text-center">Outcome</th>
                <th scope="col" className="px-6 py-4 text-center">Speaker Score</th>
                <th scope="col" className="px-6 py-4 text-right pr-8">Promotion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPerformers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm italic">
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
                        isSelected ? "bg-emerald-500/5 hover:bg-emerald-500/10" : "hover:bg-muted/20"
                      )}
                    >
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={performer} size="sm" />
                          <div>
                            <p className="font-semibold text-sm text-foreground">
                              {performer.firstName} {performer.lastName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {performer.college || "No College"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                          performer.won
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {performer.won ? "Won Match" : "Lost Match"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground font-mono font-bold text-sm border border-border">
                          {performer.score.toFixed(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right pr-8">
                        <button
                          type="button"
                          onClick={() => handleTogglePromote(performer.userId)}
                          aria-label={`Toggle promotion for ${performer.firstName} ${performer.lastName}`}
                          aria-pressed={isSelected}
                          className="inline-flex items-center justify-center w-11 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className={cn("relative block w-11 h-6 rounded-full transition-colors", isSelected ? "bg-primary" : "bg-muted border border-border")}>
                            <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform", isSelected ? "bg-primary-foreground translate-x-5" : "bg-foreground translate-x-0")} />
                          </span>
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
    </Motion.div>
  );
}
