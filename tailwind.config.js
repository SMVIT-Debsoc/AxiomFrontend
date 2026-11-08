/** @type {import('tailwindcss').Config} */
const greenRamp = {
    50: "#DFF4EB", 100: "#C6E1D4", 200: "#AAD2BA", 300: "#6B8F71", 400: "#AAD2BA",
    500: "#3F6B49", 600: "#2F5438", 700: "#28432F", 800: "#1F3626", 900: "#171F19", 950: "#10150F",
};
const warnRamp = {
    50: "#E6F8F1", 100: "#DAF1E6", 200: "#C6E1D4", 300: "#AAD2BA", 400: "#8DB596",
    500: "#6B8F71", 600: "#4F7556", 700: "#3F5E45", 800: "#2F4634", 900: "#232F26", 950: "#181D19",
};
const infoRamp = {
    50: "#DFF4EB", 100: "#B8D5C5", 200: "#C1C1C1", 300: "#A1A1A1", 400: "#7B7B7B",
    500: "#5E5E5E", 600: "#4A5646", 700: "#3D3D3D", 800: "#2F2F2F", 900: "#232323", 950: "#171F19",
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
