import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Save
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";
import { UserAvatar } from "../../components/ui/UserAvatar";

export default function AdminResultSubmission() {
    const { id: debateId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();

    const [debate, setDebate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        debater1Score: "",
        debater2Score: "",
        winnerId: ""
    });

    useEffect(() => {
        const fetchDebate = async () => {
            try {
                const token = await getToken();
                const response = await AdminApi.apiRequest(`/debates/${debateId}`, "GET", null, token);
                if (response.success) {
                    setDebate(response.debate);
                    if (response.debate.status === 'COMPLETED') {
                        setFormData({
                            debater1Score: response.debate.debater1Score?.toString() || "",
                            debater2Score: response.debate.debater2Score?.toString() || "",
                            winnerId: response.debate.winnerId || ""
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to fetch debate:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDebate();
    }, [debateId, getToken]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.winnerId) {
            alert("Please select a winner");
            return;
        }

        setSubmitting(true);
        try {
            const token = await getToken();
            const response = await AdminApi.submitResult(debateId, {
                debater1Score: parseFloat(formData.debater1Score),
                debater2Score: parseFloat(formData.debater2Score),
                winnerId: formData.winnerId
            }, token);

            if (response.success) {
                alert("Result submitted successfully!");
                navigate(`/admin/rounds/${debate.roundId}`);
            } else {
                alert(response.error || "Failed to submit result");
            }
        } catch {
            alert("Error submitting result");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!debate) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Debate not found</p>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="mt-4 px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Go back
                </button>
            </div>
        );
    }

    return (
        <Motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-8"
        >
            <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
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
                        <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400">Decision & Scoring</span>
                        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Submit Debate Result</h1>
                        <p className="text-sm text-muted-foreground mt-0.5 font-mono">Debate ID: {debateId}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Debater 1 */}
                    <div className={`p-6 md:p-8 rounded-2xl border transition-all ${
                        formData.winnerId === debate.debater1Id
                            ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                            : 'border-border bg-card'
                    }`}>
                        <div className="flex items-center gap-4 mb-6">
                            <UserAvatar
                                user={debate.debater1}
                                imageUrl={debate.debater1.imageUrl}
                                size="xl"
                            />
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Opponent 1</p>
                                <h3 className="text-xl font-heading font-bold text-foreground">
                                    {debate.debater1.firstName} {debate.debater1.lastName}
                                </h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="speaker-score-1" className="text-sm font-medium mb-1.5 block text-foreground">
                                    Speaker Score (60-100)
                                </label>
                                <input
                                    id="speaker-score-1"
                                    aria-label={`Speaker Score (60-100) for ${debate.debater1.firstName} ${debate.debater1.lastName}`}
                                    type="number"
                                    step="0.5"
                                    required
                                    min="0"
                                    max="100"
                                    value={formData.debater1Score}
                                    onChange={(e) => setFormData({ ...formData, debater1Score: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-lg font-semibold text-foreground transition-colors"
                                    placeholder="85.5"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, winnerId: debate.debater1Id })}
                                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    formData.winnerId === debate.debater1Id
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                }`}
                            >
                                {formData.winnerId === debate.debater1Id && <CheckCircle2 className="w-5 h-5" />}
                                {formData.winnerId === debate.debater1Id ? 'Winner Selected' : 'Set as Winner'}
                            </button>
                        </div>
                    </div>

                    {/* Debater 2 */}
                    <div className={`p-6 md:p-8 rounded-2xl border transition-all ${
                        formData.winnerId === debate.debater2Id
                            ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                            : 'border-border bg-card'
                    }`}>
                        <div className="flex items-center gap-4 mb-6">
                            <UserAvatar
                                user={debate.debater2}
                                imageUrl={debate.debater2.imageUrl}
                                size="xl"
                            />
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Opponent 2</p>
                                <h3 className="text-xl font-heading font-bold text-foreground">
                                    {debate.debater2.firstName} {debate.debater2.lastName}
                                </h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="speaker-score-2" className="text-sm font-medium mb-1.5 block text-foreground">
                                    Speaker Score (60-100)
                                </label>
                                <input
                                    id="speaker-score-2"
                                    aria-label={`Speaker Score (60-100) for ${debate.debater2.firstName} ${debate.debater2.lastName}`}
                                    type="number"
                                    step="0.5"
                                    required
                                    min="0"
                                    max="100"
                                    value={formData.debater2Score}
                                    onChange={(e) => setFormData({ ...formData, debater2Score: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-lg font-semibold text-foreground transition-colors"
                                    placeholder="82.0"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, winnerId: debate.debater2Id })}
                                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    formData.winnerId === debate.debater2Id
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                }`}
                            >
                                {formData.winnerId === debate.debater2Id && <CheckCircle2 className="w-5 h-5" />}
                                {formData.winnerId === debate.debater2Id ? 'Winner Selected' : 'Set as Winner'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex items-start gap-3.5">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-sm text-amber-600 dark:text-amber-400">Validation Note</h4>
                        <p className="text-sm text-amber-700/90 dark:text-amber-300/80 leading-relaxed mt-0.5">
                            Submitting high scores improves users&apos; rankings on the leaderboard. Ensure scores reflect the actual debate performance. Once submitted, the round statistics will be updated automatically.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {debate.status === 'COMPLETED' ? 'Update Final Result' : 'Submit Final Result'}
                    </button>
                </div>
            </form>
        </Motion.div>
    );
}
