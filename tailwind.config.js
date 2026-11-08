/** @type {import('tailwindcss').Config} */
const greenRamp = {
    50: "#E4F1D9", 100: "#CFE2C5", 200: "#93B1A7", 300: "#7A918D", 400: "#99C2A2",
    500: "#3E6B5E", 600: "#35594E", 700: "#2F4B42", 800: "#243D37", 900: "#1B2D28", 950: "#121F1C",
};
const warnRamp = {
    50: "#EBF6E0", 100: "#DFEFD2", 200: "#E8CE96", 300: "#E0BC74", 400: "#D4A24C",
    500: "#B8832F", 600: "#8F6320", 700: "#6B4510", 800: "#55360D", 900: "#40290A", 950: "#2B1B06",
};
const infoRamp = {
    50: "#E4F1D9", 100: "#C5DABD", 200: "#C1C1C1", 300: "#A1A1A1", 400: "#7B7B7B",
    500: "#5E5E5E", 600: "#47695F", 700: "#3D3D3D", 800: "#2F2F2F", 900: "#232323", 950: "#1B2D28",
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
