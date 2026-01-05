import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Calendar, ArrowUpRight, CheckCircle2, MapPin } from 'lucide-react';

export default function DashboardHome() {
    const stats = [
        { label: "Debates", value: "8", color: "text-foreground" },
        { label: "Wins", value: "8", color: "text-green-600" },
        { label: "Avg Score", value: "90.1", color: "text-primary" },
    ];

    return (
        <div className="space-y-6 max-w-md mx-auto md:max-w-4xl md:mx-0">
            {/* Profile Header */}
            <div className="bg-[#6D28D9] text-white p-6 rounded-3xl shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                        AS
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Alice Smith</h1>
                        <p className="text-white/80 text-sm">ABC College</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-medium uppercase">Debater</span>
                            <span className="text-xs">Rank #1</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between bg-white rounded-2xl p-4 text-center shadow-sm">
                    {stats.map((stat) => (
                        <div key={stat.label} className="flex-1 border-r last:border-0 border-gray-100">
                            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Active Event Card */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-[#F97316] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden"
            >
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1 opacity-90 text-sm font-medium">
                        <Calendar className="w-4 h-4" /> ACTIVE EVENT
                    </div>
                    <h2 className="text-2xl font-bold mb-1">Axiom 2026</h2>
                    <p className="opacity-90 text-sm mb-4">Annual Debate Competition</p>

                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-sm">
                        Round 2 · Ongoing
                    </div>
                </div>
                <ArrowUpRight className="absolute top-6 right-6 w-6 h-6 z-10 opacity-75" />

                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            </motion.div>

            {/* Check-In Status */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-bold text-lg">Check-In Status</h3>
                    <span className="text-xs text-muted-foreground">Round 2</span>
                </div>
                <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-foreground">Checked In</p>
                            <p className="text-xs text-muted-foreground">Today at 8:30 AM</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        Present
                    </span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-muted/30 rounded-xl text-xs font-medium text-muted-foreground">
                    <span>Check-in Window</span>
                    <span>8:00 AM - 9:00 AM</span>
                </div>
            </div>

            {/* Next Debate */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-bold text-lg">Your Next Debate</h3>
                    <button className="text-primary text-sm font-medium hover:underline">View All</button>
                </div>
                <div className="bg-white dark:bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-primary font-bold text-sm">Quarter Finals</span>
                        <span className="text-neutral-500 text-xs">Room: Hall A</span>
                    </div>

                    <p className="font-medium text-foreground mb-6 leading-relaxed">
                        Motion: This house believes that artificial intelligence will do more harm than good in the creative arts.
                    </p>

                    <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20">
                            View Room Location
                        </button>
                        <button className="p-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground">
                            <MapPin className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
