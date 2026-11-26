import type { Config } from 'tailwindcss';

/**
 * CAMPUS ORBIT — Playful Spatial Social UI
 * Design tokens for NUBCONNECT.
 *  Light: warm cream campus paper + midnight-plum ink.
 *  Dark : a separately designed midnight-plum night theme.
 *
 * Contrast contract (WCAG 2.2 AA, verified 2026-11-10):
 *  • Primary buttons: bg-violet (#927CFA) + text-plum (#211B35) = 5.10:1 —
 *    the signature "ink-on-vivid" look, passes in BOTH themes.
 *  • Accent text on light: violet-ink 5.43:1 white / 4.84:1 cream / 4.62:1 soft.
 *  • Accent text in dark: #A79AFB = 6.09:1 dark-card / 4.80:1 dark-soft
 *    (applied via html.dark overrides in globals.css).
 *  • aqua-ink 6.41:1 / lime-ink 6.11:1 / coral-ink 5.92:1 on white.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        campus: {
          // Light surfaces — warm cream campus paper
          bg: '#F6F3EB',
          card: '#FFFDF8',
          text: '#202A37', // Ink Navy on Warm Ivory
          'text-sec': '#56616E',
          border: '#DFDACE',
          // Dark (Editorial Campus night theme)
          'dark-bg': '#171E29',
          'dark-card': '#252F3D',
          'dark-elev': '#303A48',
          'dark-text': '#F6F3EB',
          'dark-sec': '#AEB9C6',
          'dark-border': '#3A4553',
        },
        plum: '#211B35', // ink used on vivid fills (violet, coral, lime)
        violet: {
          DEFAULT: '#927CFA', // Electric Violet — fills, icons, decorative
          hover: '#A18DFC', // brightens on hover (6.07:1 with plum text)
          // ink: Electric Violet as TEXT on light surfaces — #927CFA measures
          // only 3.24:1 on white. #6B54D6 clears AA everywhere on light
          // (5.43:1 white, 4.84:1 cream, 4.62:1 violet-soft).
          ink: '#6B54D6',
          soft: '#EFEAFE',
          'dark-soft': '#3A3068',
        },
        aqua: {
          DEFAULT: '#72DCCB', // Aqua — icons/decorative on dark, fills with plum text
          // #72DCCB measures 1.64:1 on white — ink clears AA (6.41:1 white, 5.71:1 soft)
          ink: '#0F6B5C',
          soft: '#E3F6F1',
        },
        lime: {
          DEFAULT: '#C9F36B', // Fresh Lime — fills with plum text (12.9:1)
          // #C9F36B is a near-white luminance; ink is the text form
          // (6.11:1 white, 5.59:1 lime-soft, 4.81:1 on lime fills)
          ink: '#4E6B10',
          soft: '#F1F8DC',
        },
        coral: {
          DEFAULT: '#FF735D', // Warm Coral — fills with plum text (6.18:1)
          // ink: coral as TEXT — #FF735D measures 2.67:1 on white and 2.3:1
          // on coral-soft. #B93317 clears AA on both (5.92:1 white, 5.23:1 soft)
          // and serves as a badge background for white text (5.9:1).
          ink: '#B93317',
          soft: '#FFEDE9',
        },
        sunshine: { DEFAULT: '#F1D36B', soft: '#FCF4DD' },
        /** EDITORIAL CAMPUS — signature palette, kept separate from the
         *  established interaction colors so existing contrast contracts hold. */
        editorial: {
          ink: '#202A37',
          ivory: '#F6F3EB',
          lime: '#E7F36A',
          coral: '#EF846D',
          violet: '#8C7BC1',
          night: '#171E29',
          surface: '#252F3D',
          elevated: '#303A48',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        skeleton: 'var(--skeleton)',
        border: 'var(--btn-border)',
        input: 'var(--input)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-manrope)', 'var(--font-jakarta)', 'sans-serif'],
        editorial: ['var(--font-editorial)', 'Georgia', 'serif'],
        bengali: ['var(--font-bengali)', 'var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(33,27,53,.05), 0 8px 24px -16px rgba(33,27,53,.25)',
        lift: '0 2px 6px rgba(33,27,53,.06), 0 20px 48px -24px rgba(33,27,53,.35)',
        glass: 'inset 0 1px 0 rgba(255,255,255,.35), 0 12px 32px -18px rgba(33,27,53,.45)',
        'violet-glow': '0 0 0 1px rgba(146,124,250,.28), 0 10px 28px -10px rgba(146,124,250,.6)',
        input: [
          '0px 2px 3px -1px rgba(0, 0, 0, 0.1)',
          '0px 1px 0px 0px rgba(25, 28, 33, 0.02)',
          '0px 0px 0px 1px rgba(25, 28, 33, 0.08)',
        ].join(', '),
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(.85)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        msgIn: {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // CAMPUS ORBIT signature: interest nodes gently orbit
        orbit: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // Campus Passport: stamps land with a satisfying press
        stampIn: {
          '0%': { opacity: '0', transform: 'scale(1.8) rotate(-10deg)' },
          '60%': { opacity: '1', transform: 'scale(.94) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        ripple: {
          '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)' },
          '50%': { transform: 'translate(-50%, -50%) scale(0.9)' },
        },
        // Signature banner: a seamless marquee (content is duplicated in the
        // component, so -50% lands exactly on the loop point).
        ticker: {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(-50%, 0, 0)' },
        },
        portraitFloat: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(var(--portrait-tilt, 0deg))' },
          '50%': { transform: 'translate3d(0, -7px, 0) rotate(var(--portrait-tilt, 0deg))' },
        },
        portraitFloatAlt: {
          '0%, 100%': { transform: 'translate3d(0, -5px, 0) rotate(var(--portrait-tilt, 0deg))' },
          '50%': { transform: 'translate3d(0, 3px, 0) rotate(var(--portrait-tilt, 0deg))' },
        },
      },
      animation: {
        'fade-up': 'fadeUp .45s cubic-bezier(.16,1,.3,1) both',
        pop: 'pop .28s cubic-bezier(.34,1.56,.64,1) both',
        'sheet-up': 'sheetUp .32s cubic-bezier(.16,1,.3,1) both',
        'msg-in': 'msgIn .25s cubic-bezier(.16,1,.3,1) both',
        'slide-down': 'slideDown .2s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
        'orbit-slow': 'orbit 26s linear infinite',
        'orbit-slower': 'orbit 44s linear infinite reverse',
        'stamp-in': 'stampIn .5s cubic-bezier(.34,1.56,.64,1) both',
        ripple: 'ripple 2s ease calc(var(--i, 0) * 0.2s) infinite',
        orbit: 'orbit calc(var(--duration) * 1s) linear infinite',
        ticker: 'ticker 30s linear infinite',
        'portrait-float': 'portraitFloat 7s ease-in-out infinite',
        'portrait-float-alt': 'portraitFloatAlt 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
