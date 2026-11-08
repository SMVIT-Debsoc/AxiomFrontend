/** @type {import('tailwindcss').Config} */
const greenRamp = {
    50: "#ECF1EE", 100: "#D5E1DA", 200: "#B0C7BA", 300: "#86A794", 400: "#5C8570",
    500: "#2E5645", 600: "#1E3B2F", 700: "#172F25", 800: "#12241C", 900: "#0D1B15", 950: "#08110D",
};
const warnRamp = {
    50: "#F6EBD6", 100: "#F1E0BB", 200: "#E8CE96", 300: "#E0BC74", 400: "#D4A24C",
    500: "#B8832F", 600: "#8F6320", 700: "#6B4510", 800: "#55360D", 900: "#40290A", 950: "#2B1B06",
};
const infoRamp = {
    50: "#EAF1EE", 100: "#D5E3DD", 200: "#B1C9BF", 300: "#8BAC9E", 400: "#5F8A79",
    500: "#3F6E5D", 600: "#2E5645", 700: "#244A3C", 800: "#1B392E", 900: "#142B22", 950: "#0C1B15",
};

export default {
    darkMode: ["class"],
    content: [
        './pages/**/*.{js,jsx}',
        './components/**/*.{js,jsx}',
        './app/**/*.{js,jsx}',
        './src/**/*.{js,jsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                display: ["var(--font-display)"],
                heading: ["var(--font-heading)"],
                sans: ["var(--font-body)"],
            },
            colors: {
                axiom: {
                    DEFAULT: "var(--axiom-green-primary)",
                    dark: "var(--axiom-green-dark)",
                    light: "var(--axiom-green-light)",
                    ink: "var(--axiom-logo-ink)",
                },
                emerald: greenRamp,
                green: greenRamp,
                teal: greenRamp,
                lime: greenRamp,
                amber: warnRamp,
                yellow: warnRamp,
                blue: infoRamp,
                sky: infoRamp,
                cyan: infoRamp,
                jungle: "var(--axiom-jungle)",
                "slate-green": "var(--axiom-slate)",
                moss: "var(--axiom-moss)",
                alabaster: "var(--axiom-alabaster)",
                "soft-green": "var(--axiom-soft-green)",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: 0 },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: 0 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [],
}
