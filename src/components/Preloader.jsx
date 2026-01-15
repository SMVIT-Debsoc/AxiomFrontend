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
              {/* Glow Effect Behind Astronaut */}
              <motion.div
                className="absolute inset-0 -m-8"
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="w-full h-full rounded-full bg-gradient-radial from-purple-600/40 via-purple-600/20 to-transparent blur-2xl" />
              </motion.div>

              {/* Astronaut Image */}
              <motion.div
                initial={{scale: 0, rotate: -10}}
                animate={{scale: 1, rotate: 0}}
                transition={{
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                }}
                className="relative z-10"
              >
                <img
                  src="/astronaut.png"
                  alt="AXIOM Astronaut"
                  className="w-[280px] h-auto drop-shadow-2xl"
                />
              </motion.div>

              {/* Floating Particles around Astronaut */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-purple-400 rounded-full"
                  style={{
                    left: `${50 + Math.cos((i * Math.PI) / 4) * 100}px`,
                    top: `${50 + Math.sin((i * Math.PI) / 4) * 100}px`,
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
                    className="inline-block bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent"
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
                    className="w-3 h-3 bg-amber-400 rounded-full"
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
              className="mt-6 text-amber-300 text-base font-semibold tracking-[0.3em]"
            >
              SMVIT DEBSOC
            </motion.p>

            {/* Tagline */}
            <motion.p
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 1.4}}
              className="mt-2 text-amber-400/60 text-xs tracking-widest"
            >
              POWERED BY JunnEX
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
