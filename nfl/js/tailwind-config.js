/* ── NFL26 pregame-studio palette ──────────────────────────────────────────
   The studio direction (home hero + schedule) is a warm charcoal base with a
   single gold accent. Remapping Tailwind's ramps here re-skins every utility
   class in the app at once, so `bg-slate-800` / `text-slate-400` and friends
   resolve to studio surfaces instead of the old navy-blue scale. Semantic
   families (green / red / steel) keep their meaning but drop the neon chroma.
   Guarded: the CDN above can fail (offline, blocked), and an unguarded
   assignment to `tailwind` would throw and abort the rest of the page. */
window.tailwind = window.tailwind || {};
tailwind.config = {
  theme: {
    extend: {
      colors: {
        /* Warm charcoal neutrals — replaces the navy `slate` scale */
        slate: {
          50: '#f4f2ef', 100: '#e9e7e3', 200: '#dbd9d4', 300: '#c9ccd1',
          400: '#8f9299', 500: '#868a91', 600: '#3d434c', 700: '#2b3037',
          800: '#16191f', 900: '#101215', 950: '#08090b',
        },
        /* Studio gold — the single accent */
        amber: {
          50: '#faf3e4', 100: '#f5e7c4', 200: '#eed9a2', 300: '#eecb86',
          400: '#d9a441', 500: '#d9a441', 600: '#c08f34', 700: '#a3782a',
          800: '#7f5d20', 900: '#5c4317', 950: '#33260d',
        },
        yellow: {
          300: '#eecb86', 400: '#d9a441', 500: '#d9a441', 600: '#c08f34',
        },
        orange: {
          300: '#eec08a', 400: '#d99a4d', 500: '#c8853a', 600: '#a96c2c',
        },
        /* Muted broadcast steel — link / secondary accent */
        blue: {
          50: '#eef2f6', 100: '#dde5ed', 200: '#c4d2e0', 300: '#a8bfd8',
          400: '#8fa6bf', 500: '#7590aa', 600: '#5c7490', 700: '#4a5e75',
          800: '#38485a', 900: '#28333f', 950: '#161c23',
        },
        sky: {
          200: '#c4d2e0', 300: '#a8bfd8', 400: '#8fa6bf', 500: '#7590aa',
          600: '#5c7490', 700: '#4a5e75',
        },
        cyan: {
          200: '#bfe2d9', 300: '#9fd3c7', 400: '#7ec0b0', 500: '#68ac9c',
          600: '#548b7e', 700: '#436f66',
        },
        teal: {
          300: '#9fd3c7', 400: '#7ec0b0', 500: '#68ac9c', 600: '#548b7e',
        },
        /* Field green — positive / value */
        emerald: {
          50: '#eef7f2', 100: '#d7ecdf', 200: '#b9dec9', 300: '#a3d9b8',
          400: '#7cc49b', 500: '#63b487', 600: '#4e9a70', 700: '#3e7c5a',
          800: '#316148', 900: '#254735', 950: '#12281c',
        },
        green: {
          300: '#a3d9b8', 400: '#7cc49b', 500: '#63b487', 600: '#4e9a70',
        },
        /* Muted crimson — negative / alert */
        red: {
          50: '#fbefed', 100: '#f7dbd7', 200: '#f2c3bc', 300: '#f2b0a8',
          400: '#e8877c', 500: '#d4635a', 600: '#b74e47', 700: '#963e39',
          800: '#78322e', 900: '#5a2523', 950: '#331413',
        },
        rose: {
          300: '#f2b0a8', 400: '#e8877c', 500: '#d4635a', 600: '#b74e47',
        },
        /* Desaturated violet — tertiary tags (draft rounds, etc.) */
        indigo: {
          300: '#c3badd', 400: '#a89ec9', 500: '#8f83b5', 600: '#746a97',
        },
        violet: {
          300: '#c3badd', 400: '#a89ec9', 500: '#8f83b5', 600: '#746a97',
        },
        purple: {
          300: '#c3badd', 400: '#a89ec9', 500: '#8f83b5', 600: '#746a97',
        },
      },
    },
  },
};
