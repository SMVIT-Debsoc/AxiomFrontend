import { motion } from 'framer-motion';
import { ArrowRight, Zap, Trophy, BarChart3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div className="container mx-auto px-6">
            {/* Hero Section */}
            <section className="py-20 md:py-32 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20 mb-6 inline-block">
                        High-Performance Tournament Management
                    </span>
                    <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6">
                        Execute Debates with <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
                            Precision & Speed
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10">
                        Axiom automates pairings, tabulations, and room allocations so you can focus on the debate. Built for university circuits and competitive leagues.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/sign-up" className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-[0_0_30px_-5px_rgba(139,92,246,0.5)]">
                            Start Tourney <ArrowRight className="ml-2 w-4 h-4" />
                        </Link>
                        <Link to="/about" className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-border hover:bg-muted transition-colors">
                            How it Works
                        </Link>
                    </div>
                </motion.div>
            </section>

            {/* Features Grid */}
            <section className="py-20 border-t border-border/50">
                <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard
                        icon={<Zap className="w-8 h-8 text-yellow-400" />}
                        title="Instant Pairing"
                        description="Generate Swiss-system or power-matched draws in seconds. No more spreadsheets."
                        delay={0.1}
                    />
                    <FeatureCard
                        icon={<BarChart3 className="w-8 h-8 text-blue-400" />}
                        title="Live Tabulation"
                        description="Real-time scoring and feedback collection. Eliminate data entry errors forever."
                        delay={0.2}
                    />
                    <FeatureCard
                        icon={<Trophy className="w-8 h-8 text-purple-400" />}
                        title="Advanced Analytics"
                        description="Track speaker performance, judge bias, and team rankings with deep insights."
                        delay={0.3}
                    />
                </div>
            </section>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5 }}
            className="p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors group"
        >
            <div className="mb-4 bg-muted w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </motion.div>
    );
}
