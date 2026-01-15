import {useEffect, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";

export default function Preloader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time (adjust as needed)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500); // 2.5 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.5}}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#16213e] overflow-hidden"
        >
          {/* Animated Stars Background */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  opacity: [0.2, 1, 0.2],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Astronaut Container */}
            <motion.div
              initial={{y: 0}}
              animate={{
                y: [-10, 10, -10],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative mb-8"
            >
              {/* Astronaut SVG */}
              <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Helmet Glow */}
                <motion.circle
                  cx="100"
                  cy="80"
                  r="50"
                  fill="url(#glowGradient)"
                  opacity="0.3"
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Backpack */}
                <motion.rect
                  x="85"
                  y="145"
                  width="30"
                  height="35"
                  rx="5"
                  fill="#B8B8B8"
                  initial={{scale: 0}}
                  animate={{scale: 1}}
                  transition={{delay: 0.25, type: "spring"}}
                />
                <rect
                  x="92"
                  y="150"
                  width="16"
                  height="8"
                  rx="2"
                  fill="#6D28D9"
                />
                <circle cx="95" cy="165" r="2" fill="#10B981" />
                <circle cx="105" cy="165" r="2" fill="#EF4444" />

                {/* Body */}
                <motion.ellipse
                  cx="100"
                  cy="130"
                  rx="35"
                  ry="45"
                  fill="#E8E8E8"
                  initial={{scale: 0}}
                  animate={{scale: 1}}
                  transition={{delay: 0.2, type: "spring", stiffness: 200}}
                />

                {/* Body Shadow */}
                <ellipse
                  cx="100"
                  cy="135"
                  rx="30"
                  ry="40"
                  fill="url(#bodyShadow)"
                  opacity="0.1"
                />

                {/* Chest Panel */}
                <motion.rect
                  x="85"
                  y="115"
                  width="30"
                  height="30"
                  rx="4"
                  fill="#6D28D9"
                  initial={{scale: 0}}
                  animate={{scale: 1}}
                  transition={{delay: 0.4, type: "spring"}}
                />

                {/* Panel Details */}
                <rect
                  x="88"
                  y="120"
                  width="24"
                  height="2"
                  rx="1"
                  fill="#8B5CF6"
                />
                <rect
                  x="88"
                  y="125"
                  width="18"
                  height="2"
                  rx="1"
                  fill="#8B5CF6"
                />

                {/* Buttons on Chest */}
                <motion.circle
                  cx="92"
                  cy="135"
                  r="2.5"
                  fill="#10B981"
                  animate={{opacity: [1, 0.5, 1]}}
                  transition={{duration: 1.5, repeat: Infinity}}
                />
                <motion.circle
                  cx="100"
                  cy="135"
                  r="2.5"
                  fill="#F59E0B"
                  animate={{opacity: [0.5, 1, 0.5]}}
                  transition={{duration: 1.5, repeat: Infinity, delay: 0.5}}
                />
                <motion.circle
                  cx="108"
                  cy="135"
                  r="2.5"
                  fill="#EF4444"
                  animate={{opacity: [1, 0.5, 1]}}
                  transition={{duration: 1.5, repeat: Infinity, delay: 1}}
                />

                {/* Arms */}
                <motion.ellipse
                  cx="65"
                  cy="135"
                  rx="12"
                  ry="30"
                  fill="#E8E8E8"
                  initial={{rotate: 0}}
                  animate={{rotate: [-5, 5, -5]}}
                  transition={{duration: 2, repeat: Infinity}}
                  style={{transformOrigin: "65px 120px"}}
                />
                <motion.ellipse
                  cx="135"
                  cy="135"
                  rx="12"
                  ry="30"
                  fill="#E8E8E8"
                  initial={{rotate: 0}}
                  animate={{rotate: [5, -5, 5]}}
                  transition={{duration: 2, repeat: Infinity}}
                  style={{transformOrigin: "135px 120px"}}
                />

                {/* Helmet */}
                <motion.circle
                  cx="100"
                  cy="80"
                  r="40"
                  fill="url(#helmetGradient)"
                  initial={{scale: 0}}
                  animate={{scale: 1}}
                  transition={{delay: 0.1, type: "spring"}}
                />

                {/* Helmet Shine */}
                <motion.ellipse
                  cx="85"
                  cy="70"
                  rx="15"
                  ry="20"
                  fill="white"
                  opacity="0.4"
                  animate={{
                    opacity: [0.4, 0.6, 0.4],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />

                {/* Face (visible through helmet) */}
                <circle cx="95" cy="80" r="3" fill="#1F2937" />
                <circle cx="105" cy="80" r="3" fill="#1F2937" />
                <motion.path
                  d="M 92 90 Q 100 95 108 90"
                  stroke="#1F2937"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M 92 90 Q 100 95 108 90",
                      "M 92 90 Q 100 93 108 90",
                      "M 92 90 Q 100 95 108 90",
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />

                {/* Antenna */}
                <motion.line
                  x1="100"
                  y1="40"
                  x2="100"
                  y2="25"
                  stroke="#6D28D9"
                  strokeWidth="3"
                  strokeLinecap="round"
                  animate={{
                    y2: [25, 20, 25],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                  }}
                />
                <motion.circle
                  cx="100"
                  cy="20"
                  r="5"
                  fill="#EF4444"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.6, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                  }}
                />

                {/* Gradients */}
                <defs>
                  <linearGradient
                    id="helmetGradient"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#93C5FD" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                  <radialGradient id="glowGradient">
                    <stop offset="0%" stopColor="#6D28D9" />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient
                    id="bodyShadow"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Floating Particles around Astronaut */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-purple-400 rounded-full"
                  style={{
                    left: `${50 + Math.cos((i * Math.PI) / 4) * 80}px`,
                    top: `${50 + Math.sin((i * Math.PI) / 4) * 80}px`,
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>

            {/* AXIOM Text */}
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.5}}
              className="text-center"
            >
              <h1 className="text-6xl font-bold mb-4 tracking-wider">
                {["A", "X", "I", "O", "M"].map((letter, index) => (
                  <motion.span
                    key={index}
                    className="inline-block bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent"
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    transition={{
                      delay: 0.7 + index * 0.1,
                      type: "spring",
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </h1>

              {/* Loading Dots */}
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-purple-500 rounded-full"
                    animate={{
                      y: [0, -10, 0],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 1.2}}
              className="mt-6 text-purple-300 text-base font-semibold tracking-[0.3em]"
            >
              SMVIT DEBSOC
            </motion.p>

            {/* Tagline */}
            <motion.p
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 1.4}}
              className="mt-2 text-purple-400/60 text-xs tracking-widest"
            >
              POWERED BY INNOVATION
            </motion.p>
          </div>

          {/* Shooting Stars */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${Math.random() * 60}%`,
              }}
              initial={{x: 0, y: 0, opacity: 0, scale: 0}}
              animate={{
                x: [0, 150, 300],
                y: [0, 150, 300],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 1.5,
                ease: "easeOut",
              }}
            >
              <div className="relative">
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="absolute top-0 left-0 w-24 h-0.5 bg-gradient-to-r from-white via-purple-300 to-transparent -rotate-45 blur-[1px]" />
              </div>
            </motion.div>
          ))}

          {/* Orbital Rings */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            animate={{rotate: 360}}
            transition={{duration: 20, repeat: Infinity, ease: "linear"}}
          >
            <div className="w-[500px] h-[500px] border border-purple-500/10 rounded-full" />
          </motion.div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            animate={{rotate: -360}}
            transition={{duration: 30, repeat: Infinity, ease: "linear"}}
          >
            <div className="w-[600px] h-[600px] border border-purple-500/5 rounded-full" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
