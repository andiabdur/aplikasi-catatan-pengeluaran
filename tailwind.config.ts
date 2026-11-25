import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
  	extend: {
  		colors: {
  			brand: {
  				'50': '#FDF5F2',
  				'100': '#FAE6DF',
  				'200': '#F4CBBF',
  				'300': '#EAA995',
  				'400': '#E58870',
  				'500': '#C85D43',
  				'600': '#B85138',
  				'700': '#9E4029',
  				'800': '#8A3621',
  				'900': '#6B2A1A',
  				'950': '#3D160D',
  				DEFAULT: '#B85138'
  			},
  			"background-dark": "#141210",
  			"surface-dark": "#1E1B18",
  			"surface-container-high": "#282420",
  			"surface-container-highest": "#36312C",
  			"outline-variant": "#3E3832",
  			background: 'rgb(var(--background) / <alpha-value>)',
  			foreground: 'rgb(var(--foreground) / <alpha-value>)',
  			card: {
  				DEFAULT: 'rgb(var(--card) / <alpha-value>)',
  				foreground: 'rgb(var(--card-foreground) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
  				foreground: 'rgb(var(--popover-foreground) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
  				foreground: 'rgb(var(--primary-foreground) / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
  				foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
  				foreground: 'rgb(var(--muted-foreground) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
  				foreground: 'rgb(var(--accent-foreground) / <alpha-value>)'
  			},
  			destructive: {
  				DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
  				foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)'
  			},
  			border: 'rgb(var(--border) / <alpha-value>)',
  			input: 'rgb(var(--input) / <alpha-value>)',
  			ring: 'rgb(var(--ring) / <alpha-value>)',
  			chart: {
  				'1': 'rgb(var(--chart-1) / <alpha-value>)',
  				'2': 'rgb(var(--chart-2) / <alpha-value>)',
  				'3': 'rgb(var(--chart-3) / <alpha-value>)',
  				'4': 'rgb(var(--chart-4) / <alpha-value>)',
  				'5': 'rgb(var(--chart-5) / <alpha-value>)'
  			},
  			sidebar: {
  				DEFAULT: 'rgb(var(--sidebar) / <alpha-value>)',
  				foreground: 'rgb(var(--sidebar-foreground) / <alpha-value>)',
  				primary: 'rgb(var(--sidebar-primary) / <alpha-value>)',
  				'primary-foreground': 'rgb(var(--sidebar-primary-foreground) / <alpha-value>)',
  				accent: 'rgb(var(--sidebar-accent) / <alpha-value>)',
  				'accent-foreground': 'rgb(var(--sidebar-accent-foreground) / <alpha-value>)',
  				border: 'rgb(var(--sidebar-border) / <alpha-value>)',
  				ring: 'rgb(var(--sidebar-ring) / <alpha-value>)'
  			}
  		},
  		fontFamily: {
  			headline: ["Inter", "system-ui", "-apple-system", "sans-serif"],
  			sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
  			mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
