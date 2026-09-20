/** WGS84 UTM and MGRS helpers for pasted grid coordinates. */

const ECC2 = 0.00669438;
const K0 = 0.9996;
const A = 6378137;
const EASTING0 = 500000;
const NORTHING0 = 10000000;
const SET_COL0 = 'AJSAJS';
const SET_ROW0 = 'AFAFAF';
const CHAR_A = 65;
const CHAR_I = 73;
const CHAR_O = 79;
const CHAR_V = 86;
const CHAR_Z = 90;

const MIN_NORTHING: Record<string, number> = {
    C: 1100000, D: 2000000, E: 2800000, F: 3700000, G: 4600000,
    H: 5500000, J: 6400000, K: 7300000, L: 8200000, M: 9100000,
    N: 0, P: 800000, Q: 1700000, R: 2600000, S: 3500000, T: 4400000,
    U: 5300000, V: 6200000, W: 7000000, X: 7900000,
};

export interface GridLatLng {
    lat: number;
    lng: number;
}

function radToDeg(rad: number): number {
    return 180 * (rad / Math.PI);
}

function utmSet(zone: number): number {
    const set = zone % 6;
    return set === 0 ? 6 : set;
}

export function utmToLatLng(
    zone: number,
    zoneLetter: string,
    easting: number,
    northing: number,
): GridLatLng | null {
    if (zone < 1 || zone > 60) return null;
    const letter = zoneLetter.toUpperCase();
    const x = easting - EASTING0;
    let y = northing;
    if (letter < 'N') y -= NORTHING0;

    const origin = (zone - 1) * 6 - 180 + 3;
    const e1 = (1 - Math.sqrt(1 - ECC2)) / (1 + Math.sqrt(1 - ECC2));
    const ep2 = ECC2 / (1 - ECC2);
    const m = y / K0;
    const mu = m / (A * (1 - ECC2 / 4 - 3 * ECC2 * ECC2 / 64 - 5 * ECC2 ** 3 / 256));
    const phi1 = mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
    const n1 = A / Math.sqrt(1 - ECC2 * Math.sin(phi1) ** 2);
    const t1 = Math.tan(phi1) ** 2;
    const c1 = ep2 * Math.cos(phi1) ** 2;
    const r1 = A * (1 - ECC2) / (1 - ECC2 * Math.sin(phi1) ** 2) ** 1.5;
    const d = x / (n1 * K0);
    const lat = phi1 - (n1 * Math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720
    );
    const lon = (d
        - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
    ) / Math.cos(phi1);

    const out = { lat: radToDeg(lat), lng: origin + radToDeg(lon) };
    if (!Number.isFinite(out.lat) || !Number.isFinite(out.lng)) return null;
    if (Math.abs(out.lat) > 90 || Math.abs(out.lng) > 180) return null;
    return out;
}

function eastingFromChar(ch: string, set: number): number | null {
    let col = SET_COL0.charCodeAt(set - 1);
    let easting = 100000;
    let rewound = false;
    const target = ch.charCodeAt(0);
    while (col !== target) {
        col += 1;
        if (col === CHAR_I || col === CHAR_O) col += 1;
        if (col > CHAR_Z) {
            if (rewound) return null;
            col = CHAR_A;
            rewound = true;
        }
        easting += 100000;
        if (easting > 900000) return null;
    }
    return easting;
}

function northingFromChar(ch: string, set: number): number | null {
    if (ch > 'V') return null;
    let row = SET_ROW0.charCodeAt(set - 1);
    let northing = 0;
    let rewound = false;
    const target = ch.charCodeAt(0);
    while (row !== target) {
        row += 1;
        if (row === CHAR_I || row === CHAR_O) row += 1;
        if (row > CHAR_V) {
            if (rewound) return null;
            row = CHAR_A;
            rewound = true;
        }
        northing += 100000;
    }
    return northing;
}

export function mgrsToLatLng(raw: string): GridLatLng | null {
    const compact = raw.toUpperCase().replace(/\s+/g, '');
    const m = compact.match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d*)$/);
    if (!m) return null;
    const zone = Number(m[1]);
    const band = m[2];
    const square = m[3];
    const digits = m[4];
    if (zone < 1 || zone > 60) return null;
    if (digits.length % 2 !== 0 || digits.length > 10) return null;

    const set = utmSet(zone);
    const east100k = eastingFromChar(square[0], set);
    let north100k = northingFromChar(square[1], set);
    if (east100k == null || north100k == null) return null;

    const minN = MIN_NORTHING[band];
    if (minN == null) return null;
    while (north100k < minN) north100k += 2000000;

    const half = digits.length / 2;
    const acc = 100000 / (10 ** half);
    const eastExtra = half ? Number(digits.slice(0, half)) * acc : 0;
    const northExtra = half ? Number(digits.slice(half)) * acc : 0;
    if (!Number.isFinite(eastExtra) || !Number.isFinite(northExtra)) return null;

    return utmToLatLng(
        zone,
        band,
        east100k + eastExtra + acc / 2,
        north100k + northExtra + acc / 2,
    );
}

const MGRS_RE = /(\d{1,2})\s*([C-HJ-NP-Xc-hj-np-x])\s*([A-HJ-NP-Za-hj-np-z]{2})\s*(?:(\d{1,5})\s+(\d{1,5})|(\d{10}|\d{8}|\d{6}|\d{4}|\d{2}))/g;

export function findMgrs(text: string): GridLatLng | null {
    MGRS_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MGRS_RE.exec(text)) !== null) {
        const digits = m[4] != null && m[5] != null
            ? (m[4].length === m[5].length ? m[4] + m[5] : '')
            : (m[6] || '');
        if (m[4] != null && m[5] != null && m[4].length !== m[5].length) continue;
        if (!digits) continue;
        const parsed = mgrsToLatLng(`${m[1]}${m[2]}${m[3]}${digits}`);
        if (parsed) return parsed;
    }
    return null;
}

const UTM_RE = /(\d{1,2})\s*([C-HJ-NP-Xc-hj-np-x])\s+(\d{5,7}(?:\.\d+)?)\s+[EN]?\s*(\d{5,7}(?:\.\d+)?)/g;

export function findUtm(text: string): GridLatLng | null {
    UTM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = UTM_RE.exec(text)) !== null) {
        const zone = Number(m[1]);
        const easting = Number(m[3]);
        const northing = Number(m[4]);
        if (easting < 100000 || easting > 900000) continue;
        if (northing < 0 || northing > 10000000) continue;
        const parsed = utmToLatLng(zone, m[2], easting, northing);
        if (parsed) return parsed;
    }
    return null;
}
