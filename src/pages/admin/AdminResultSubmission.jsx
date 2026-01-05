import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Trophy,
    User,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Save
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";

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
    }, [debateId]);

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
        } catch (error) {
            alert("Error submitting result");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!debate) return <div>Debate not found</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold">Submit Debate Result</h1>
                    <p className="text-muted-foreground">Debate ID: {debateId}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Debater 1 */}
                    <div className={`p-8 rounded-3xl border-2 transition-all ${formData.winnerId === debate.debater1Id ? 'border-purple-500 bg-purple-500/5' : 'border-border bg-card'}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-2xl">
                                {debate.debater1.firstName[0]}
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Opponent 1</p>
                                <h3 className="text-xl font-bold">{debate.debater1.firstName} {debate.debater1.lastName}</h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Speaker Score (60-100)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    required
                                    min="0"
                                    max="100"
                                    value={formData.debater1Score}
                                    onChange={(e) => setFormData({ ...formData, debater1Score: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-purple-500 outline-none text-lg font-semibold"
                                    placeholder="85.5"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, winnerId: debate.debater1Id })}
                                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${formData.winnerId === debate.debater1Id
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                {formData.winnerId === debate.debater1Id && <CheckCircle2 className="w-5" />}
                                {formData.winnerId === debate.debater1Id ? 'Winner Selected' : 'Set as Winner'}
                            </button>
                        </div>
                    </div>

                    {/* Debater 2 */}
                    <div className={`p-8 rounded-3xl border-2 transition-all ${formData.winnerId === debate.debater2Id ? 'border-purple-500 bg-purple-500/5' : 'border-border bg-card'}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-2xl">
                                {debate.debater2.firstName[0]}
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Opponent 2</p>
                                <h3 className="text-xl font-bold">{debate.debater2.firstName} {debate.debater2.lastName}</h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Speaker Score (60-100)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    required
                                    min="0"
                                    max="100"
                                    value={formData.debater2Score}
                                    onChange={(e) => setFormData({ ...formData, debater2Score: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-purple-500 outline-none text-lg font-semibold"
                                    placeholder="82.0"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, winnerId: debate.debater2Id })}
                                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${formData.winnerId === debate.debater2Id
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                {formData.winnerId === debate.debater2Id && <CheckCircle2 className="w-5" />}
                                {formData.winnerId === debate.debater2Id ? 'Winner Selected' : 'Set as Winner'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-amber-500">Validation Note</h4>
                        <p className="text-sm text-amber-500/80 leading-relaxed">
                            Submitting high scores improves users' rankings on the leaderboard. Ensure scores reflect the actual debate performance. Once submitted, the round statistics will be updated automatically.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-purple-500 text-white font-black text-lg hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/20 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {debate.status === 'COMPLETED' ? 'Update Final Result' : 'Submit Final Result'}
                    </button>
                </div>
            </form>
        </div>
    );
}
