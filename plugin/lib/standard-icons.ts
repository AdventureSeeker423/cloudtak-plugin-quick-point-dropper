/** CloudTAK Draw Point affiliation markers (2525E Land Unit SIDCs). */
export const STANDARD_PACK = '__standard__';

export interface StandardIcon {
    iconset: typeof STANDARD_PACK;
    path: string;
    name: string;
    key: string;
    url: string;
    cotType: string;
    legacyType: string;
    keywords: string;
}

function svgUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Yellow quatrefoil (unknown). Fill is drawn over the strokes so only the outer outline shows. */
const UNKNOWN_SVG = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <g fill="#FFFF00" stroke="#1a1a1a" stroke-width="2">
    <circle cx="20" cy="12" r="8.5"/>
    <circle cx="20" cy="28" r="8.5"/>
    <circle cx="12" cy="20" r="8.5"/>
    <circle cx="28" cy="20" r="8.5"/>
  </g>
  <g fill="#FFFF00">
    <circle cx="20" cy="12" r="8.5"/>
    <circle cx="20" cy="28" r="8.5"/>
    <circle cx="12" cy="20" r="8.5"/>
    <circle cx="28" cy="20" r="8.5"/>
  </g>
</svg>
`);

/** Blue rounded rectangle (friendly). */
const FRIENDLY_SVG = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect x="5" y="11" width="30" height="18" rx="3" fill="#80E0FF" stroke="#1a1a1a" stroke-width="1.5"/>
</svg>
`);

/** Red diamond (hostile). */
const HOSTILE_SVG = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect x="11" y="11" width="18" height="18" fill="#FF3B3B" stroke="#1a1a1a" stroke-width="1.5" transform="rotate(45 20 20)"/>
</svg>
`);

/** Green square (neutral). */
const NEUTRAL_SVG = svgUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect x="8" y="8" width="24" height="24" fill="#90EE90" stroke="#1a1a1a" stroke-width="1.5"/>
</svg>
`);

export const STANDARD_ICONS: StandardIcon[] = [
    {
        iconset: STANDARD_PACK,
        path: 'unknown',
        name: 'Unknown Point',
        key: 'standard:a-u-G',
        url: UNKNOWN_SVG,
        cotType: '13011000000000000000',
        legacyType: 'a-u-G',
        keywords: 'unknown yellow cross clover quatrefoil',
    },
    {
        iconset: STANDARD_PACK,
        path: 'friendly',
        name: 'Friendly Point',
        key: 'standard:a-f-G',
        url: FRIENDLY_SVG,
        cotType: '13031000000000000000',
        legacyType: 'a-f-G',
        keywords: 'friendly friend blue rectangle',
    },
    {
        iconset: STANDARD_PACK,
        path: 'hostile',
        name: 'Hostile Point',
        key: 'standard:a-h-G',
        url: HOSTILE_SVG,
        cotType: '13061000000000000000',
        legacyType: 'a-h-G',
        keywords: 'hostile enemy red diamond',
    },
    {
        iconset: STANDARD_PACK,
        path: 'neutral',
        name: 'Neutral Point',
        key: 'standard:a-n-G',
        url: NEUTRAL_SVG,
        cotType: '13041000000000000000',
        legacyType: 'a-n-G',
        keywords: 'neutral green square',
    },
];

export function standardIcons(): StandardIcon[] {
    return STANDARD_ICONS.map((icon) => ({ ...icon }));
}

export function matchStandardType(type: string): StandardIcon | undefined {
    const value = type.trim();
    if (!value) return undefined;
    return STANDARD_ICONS.find((icon) => (
        icon.cotType === value || icon.legacyType === value || icon.key === value
    ));
}
