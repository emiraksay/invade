/**
 * Invade design tokens. Same values as tokens.css (keep in sync).
 * Source: Figma "RiskWalk (Copy)" (0HVELJrA313HiBhM2hBGMd). The file has no Figma variables;
 * values come from component code and SVG fills. "approx" = sampled from screen PNGs.
 * See docs/ASSETS.md.
 */
export const tokens = {
  color: {
    bg: '#110d0b', // approx
    bgRaised: '#251f1b', // approx
    bgBottom: '#010102', // approx
    surfaceItem: 'rgba(0, 0, 0, 0.2)',
    surfaceItemHighlight: '#242120', // approx
    surfacePill: 'rgba(71, 71, 71, 0.55)',
    surfaceNavbar: 'rgba(22, 22, 22, 0.7)',
    track: '#262626', // approx
    trackFill: '#d9d9d9', // approx
    borderItemGlow: 'rgba(180, 180, 180, 0.25)',
    borderStrong: '#000000',
    textPrimary: '#ffffff',
    textSecondary: '#d9d9d9',
    textMuted: '#828282',
    textDisabled: '#555555',
    textPressedBlue: '#7e7e7e',
    textPressedNegative: '#848484',
    teamWhite: '#ffffff',
    teamBlack: '#000000', // approx
    accent: '#27679c',
    negative: '#9c2727',
    pressedOverlay: 'rgba(0, 0, 0, 0.5)',
    shadowBlueText: '#002645',
    shadowNegativeText: '#330202',
  },
  font: {
    display: '"Turret Road", "Orbitron", system-ui, sans-serif',
    body: '"Montserrat", system-ui, -apple-system, sans-serif',
    pressed: '"Bowlby One SC", "Turret Road", sans-serif',
  },
  fontWeight: {
    regular: 400,
    bold: 700,
  },
  fontSize: {
    button: '24px',
    buttonPressed: '21px',
    rank: '25px',
    playerName: '20px',
    stat: '15.652px',
  },
  radius: {
    navbar: '10px',
    item: '17px',
    pill: '20px',
    buttonPressed: '2px',
  },
  space: {
    pillY: '9px',
    pillX: '20px',
    pillGap: '10px',
    itemGap: '23px',
    statColGap: '10px',
    statRowGap: '3px',
  },
  size: {
    frameWidth: '440px',
    frameHeight: '956px',
    buttonW: '164px',
    buttonH: '64px',
    itemH: '75px',
    itemW: '518px',
    avatar: '41px',
    navbarW: '219.45px',
    navbarH: '49px',
    iconButton: '25px',
  },
  shadow: {
    item: '0 0 5px 0 rgba(180, 180, 180, 0.25)',
    buttonInset: 'inset 0 4px 0 rgba(0, 0, 0, 0.4)',
    textButton: '0 2.026px 0 #000000',
    textRank: '0 3.146px 0 #000000',
    textPressedBlue: '0 1.085px 0 #002645',
    textPressedNegative: '0 1.085px 0 #330202',
  },
} as const;

export type Tokens = typeof tokens;
export default tokens;
