/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#4a3a2e',
    tint: '#f28c0a',

    // Core surfaces
    background: '#faf7ed',
    foreground: '#4a3a2e',

    // Cards / elevated surfaces
    card: '#fdfcf7',
    cardForeground: '#4a3a2e',

    // Primary action color (buttons, links, active states)
    primary: '#f28c0a',
    primaryForeground: '#fffaf0',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f2eadc',
    secondaryForeground: '#4a3a2e',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#f3efe5',
    mutedForeground: '#806e5a',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f9dfb4',
    accentForeground: '#925208',

    // Destructive actions (delete, error states)
    destructive: '#e23f3f',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#e8dfd1',
    input: '#e8dfd1',
  },

  dark: {
    text: '#f7f0dc',
    tint: '#f5a329',
    background: '#30251f',
    foreground: '#f7f0dc',
    card: '#3e3028',
    cardForeground: '#f7f0dc',
    primary: '#f5a329',
    primaryForeground: '#30251f',
    secondary: '#43352d',
    secondaryForeground: '#f4ead4',
    muted: '#3b2f29',
    mutedForeground: '#b29b7c',
    accent: '#594021',
    accentForeground: '#f8d49c',
    destructive: '#df4d4d',
    destructiveForeground: '#ffffff',
    border: '#514139',
    input: '#514139',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
