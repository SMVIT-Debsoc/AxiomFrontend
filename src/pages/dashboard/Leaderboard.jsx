import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Search, Filter, ArrowUp, ArrowDown, User } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Leaderboard() {
    const [filter, setFilter] = useState('all');

    // Mock Data
    const leaderboard = [
        { rank: 1, name: "Alice Smith", college: "ABC College", points: 854, winRate: "92%", trend: "up", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" },
        { rank: 2, name: "John Doe", college: "XYZ University", points: 840, winRate: "88%", trend: "up", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John" },
        { rank: 3, name: "Sarah Connor", college: "Tech Institute", points: 815, winRate: "85%", trend: "down", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" },
        { rank: 4, name: "Michael Ross", college: "Pearson Hardman", points: 790, winRate: "80%", trend: "same", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike" },
        { rank: 5, name: "Rachel Green", college: "Central Perk U", points: 750, winRate: "78%", trend: "up", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rachel" },
        // ... generate more if needed
    ];

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Trophy className="w-8 h-8 text-yellow-500" /> Leaderboard
                    </h1>
                    <p className="text-muted-foreground mt-1">Top performing debaters across all tournaments.</p>
                </div>

                <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
                    {['All Time', 'Season 26', 'Monthly'].map((period) => (
                        <button
                            key={period}
                            onClick={() => setFilter(period.toLowerCase().replace(' ', '-'))}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                                filter === period.toLowerCase().replace(' ', '-')
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top 3 Podium (Optional but cool) */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 items-end mb-12 px-4">
                <div className="order-2 md:order-1 flex flex-col items-center">
                    <div className="relative">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-300 overflow-hidden bg-slate-200">
                            <img src={leaderboard[1].avatar} alt="2nd" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-800">2</div>
                    </div>
                    <div className="text-center mt-3">
                        <p className="font-bold truncate max-w-[100px]">{leaderboard[1].name}</p>
                        <p className="text-sm text-muted-foreground">{leaderboard[1].points} pts</p>
                    </div>
                </div>

                <div className="order-1 md:order-2 flex flex-col items-center -mt-8">
                    <div className="relative">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-yellow-400 overflow-hidden bg-yellow-100 shadow-[0_0_30px_-10px_rgba(250,204,21,0.5)]">
                            <img src={leaderboard[0].avatar} alt="1st" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                            <Trophy className="w-10 h-10 text-yellow-500 fill-yellow-500 drop-shadow-lg" />
                        </div>
                    </div>
                    <div className="text-center mt-6">
                        <p className="font-bold text-lg">{leaderboard[0].name}</p>
                        <p className="text-primary font-bold">{leaderboard[0].points} pts</p>
                    </div>
                </div>

                <div className="order-3 flex flex-col items-center">
                    <div className="relative">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-amber-600 overflow-hidden bg-amber-100">
                            <img src={leaderboard[2].avatar} alt="3rd" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center font-bold text-white">3</div>
                    </div>
                    <div className="text-center mt-3">
                        <p className="font-bold truncate max-w-[100px]">{leaderboard[2].name}</p>
                        <p className="text-sm text-muted-foreground">{leaderboard[2].points} pts</p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            placeholder="Search debater..."
                            className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-transparent rounded-lg focus:bg-background focus:border-border outline-none transition-all"
                        />
                    </div>
                    <button className="p-2 border border-border rounded-lg hover:bg-muted text-muted-foreground">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4 text-left w-20">Rank</th>
                                <th className="px-6 py-4 text-left">Debater</th>
                                <th className="px-6 py-4 text-left hidden md:table-cell">College</th>
                                <th className="px-6 py-4 text-right">Win Rate</th>
                                <th className="px-6 py-4 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {leaderboard.map((user) => (
                                <motion.tr
                                    key={user.rank}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="group hover:bg-muted/20 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                                            user.rank <= 3 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                                        )}>
                                            #{user.rank}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatar} className="w-8 h-8 rounded-full bg-muted" alt={user.name} />
                                            <span className="font-semibold">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                                        {user.college}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-muted-foreground">
                                        {user.winRate}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-foreground">{user.points}</span>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
