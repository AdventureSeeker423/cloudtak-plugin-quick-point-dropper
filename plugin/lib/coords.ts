import { findMgrs, findUtm } from './coords-grid.ts';

/** Decimal lat/lng extracted from mixed pasted text. */
export interface LatLng {
    lat: number;
    lng: number;
    text: string;
}

function validLat(n: number): boolean {
    return Number.isFinite(n) && Math.abs(n) <= 90;
}

function validLng(n: number): boolean {
    return Number.isFinite(n) && Math.abs(n) <= 180;
}

function fmt(n: number): string {
    const s = n.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
}

function asPair(lat: number, lng: number): LatLng | null {
    if (!validLat(lat) || !validLng(lng)) return null;
    return { lat, lng, text: `${fmt(lat)}, ${fmt(lng)}` };
}

function applyHemi(value: number, hemi: string): number {
    const h = hemi.toUpperCase();
    if (h === 'S' || h === 'W') return -Math.abs(value);
    if (h === 'N' || h === 'E') return Math.abs(value);
    return value;
}

function hemiKind(hemi: string): 'lat' | 'lng' | '' {
    const h = hemi.toUpperCase();
    if (h === 'N' || h === 'S') return 'lat';
    if (h === 'E' || h === 'W') return 'lng';
    return '';
}

function pairFromAngles(
    aVal: number,
    aHemi: string,
    bVal: number,
    bHemi: string,
): LatLng | null {
    const aKind = hemiKind(aHemi);
    const bKind = hemiKind(bHemi);
    if (aKind === 'lat' && bKind === 'lng') {
        return asPair(applyHemi(aVal, aHemi), applyHemi(bVal, bHemi));
    }
    if (aKind === 'lng' && bKind === 'lat') {
        return asPair(applyHemi(bVal, bHemi), applyHemi(aVal, aHemi));
    }
    if (!aKind && !bKind) {
        if (validLat(aVal) && validLng(bVal)) return asPair(aVal, bVal);
        if (!validLat(aVal) && validLat(bVal)) return asPair(bVal, aVal);
    }
    return null;
}

function normalize(raw: string): string {
    return raw
        .replace(/[\u2212\u2013\u2014]/g, '-')
        .replace(/[º]/g, '°')
        .replace(/[′’]/g, "'")
        .replace(/[″”“]/g, '"');
}

function looksSexagesimal(text: string): boolean {
    return /[°'"]/.test(text) || /\d+\s*:\s*\d+/.test(text);
}

interface AngleTok {
    value: number;
    hemi: string;
}

function dmsValue(d: number, m: number, s: number): number | null {
    if (m >= 60 || s >= 60) return null;
    if (Math.abs(d) > 180) return null;
    return Math.abs(d) + m / 60 + s / 3600;
}

const DMS_RE = /([NSEWnsew])?\s*(\d{1,3})\s*(?:°|deg\b|d|:)\s*(\d{1,2})\s*(?:'|min\b|m|:)\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|sec\b|s)?\s*([NSEWnsew])?/g;
const DMS_SPACE_RE = /([NSEWnsew])?\s*(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NSEWnsew])/g;
const DDM_RE = /([NSEWnsew])?\s*(\d{1,3})\s*(?:°|deg\b|d|:)\s*(\d{1,2}(?:\.\d+)?)\s*'?\s*([NSEWnsew])?/g;

function collect(re: RegExp, text: string, seconds: boolean): AngleTok[] {
    re.lastIndex = 0;
    const out: AngleTok[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const hemi = (m[1] || m[seconds ? 5 : 4] || '').toUpperCase();
        const value = dmsValue(Number(m[2]), Number(m[3]), seconds ? Number(m[4]) : 0);
        if (value == null) continue;
        out.push({ value, hemi });
    }
    return out;
}

function pairFromList(angles: AngleTok[]): LatLng | null {
    if (angles.length < 2) return null;
    return pairFromAngles(angles[0].value, angles[0].hemi, angles[1].value, angles[1].hemi);
}

function parseSexagesimal(text: string): LatLng | null {
    return pairFromList(collect(DMS_RE, text, true))
        || pairFromList(collect(DMS_SPACE_RE, text, true))
        || pairFromList(collect(DDM_RE, text, false));
}

const NMEA_RE = /(?:^|[^A-Za-z0-9])(\d{2,3})(\d{2}\.\d+)\s*([NSns])\s*[,;\s/]+(\d{2,3})(\d{2}\.\d+)\s*([EWew])/g;

function parseNmea(text: string): LatLng | null {
    NMEA_RE.lastIndex = 0;
    const m = NMEA_RE.exec(text);
    if (!m) return null;
    const lat = dmsValue(Number(m[1]), Number(m[2]), 0);
    const lng = dmsValue(Number(m[4]), Number(m[5]), 0);
    if (lat == null || lng == null) return null;
    return pairFromAngles(lat, m[3], lng, m[6]);
}

function parseGeoUri(text: string): LatLng | null {
    const m = text.match(/geo:([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/i);
    if (!m) return null;
    return asPair(Number(m[1]), Number(m[2]));
}

function decimalPlaces(raw: string): number {
    const i = raw.indexOf('.');
    return i < 0 ? 0 : raw.length - i - 1;
}

interface NumToken {
    value: number;
    raw: string;
    hemi: string;
}

function tokenize(raw: string): NumToken[] {
    const text = raw.replace(/[°]/g, ' ');
    const re = /(?:^|[^A-Za-z0-9.+-])(?:([NSEWnsew])\s*)?([+-]?(?:\d+\.\d+|\.\d+|\d+))(?:\s*([NSEWnsew]))?/g;
    const out: NumToken[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const rawNum = m[2];
        const value = Number(rawNum);
        if (!Number.isFinite(value)) continue;
        out.push({
            value,
            raw: rawNum,
            hemi: m[1] || m[3] || '',
        });
        if (m[0].length === 0) re.lastIndex += 1;
    }
    return out;
}

function pairScore(lat: number, lng: number, latRaw: string, lngRaw: string): number {
    if (!validLat(lat) || !validLng(lng)) return -1;
    let score = 1;
    const latDec = decimalPlaces(latRaw);
    const lngDec = decimalPlaces(lngRaw);
    if (latDec > 0 || lngDec > 0) score += 8;
    if (latDec >= 4 || lngDec >= 4) score += 6;
    if (Math.abs(lng) > 90) score += 4;
    if (lat !== 0 || lng !== 0) score += 1;
    return score;
}

function signedRaw(value: number, raw: string): string {
    return (value < 0 ? '-' : '') + raw.replace(/^[+-]/, '');
}

function asLatLng(
    lat: number,
    lng: number,
    latRaw: string,
    lngRaw: string,
): LatLng | null {
    if (pairScore(lat, lng, latRaw, lngRaw) < 0) return null;
    return {
        lat,
        lng,
        text: `${signedRaw(lat, latRaw)}, ${signedRaw(lng, lngRaw)}`,
    };
}

function parseDecimal(raw: string): LatLng | null {
    const tokens = tokenize(raw);
    if (tokens.length < 2) return null;

    const latTok = tokens.find((t) => hemiKind(t.hemi) === 'lat');
    const lngTok = tokens.find((t) => hemiKind(t.hemi) === 'lng');
    if (latTok && lngTok) {
        const parsed = asLatLng(
            applyHemi(latTok.value, latTok.hemi),
            applyHemi(lngTok.value, lngTok.hemi),
            latTok.raw,
            lngTok.raw,
        );
        if (parsed) return parsed;
    }

    let best: LatLng | null = null;
    let bestScore = -1;
    for (let i = 0; i < tokens.length - 1; i++) {
        const a = tokens[i];
        const b = tokens[i + 1];
        const aVal = a.hemi ? applyHemi(a.value, a.hemi) : a.value;
        const bVal = b.hemi ? applyHemi(b.value, b.hemi) : b.value;

        const latLng = asLatLng(aVal, bVal, a.raw, b.raw);
        const latLngScore = latLng ? pairScore(aVal, bVal, a.raw, b.raw) : -1;
        if (latLng && latLngScore > bestScore) {
            bestScore = latLngScore;
            best = latLng;
        }

        if (!validLat(aVal)) {
            const swapped = asLatLng(bVal, aVal, b.raw, a.raw);
            const swappedScore = swapped ? pairScore(bVal, aVal, b.raw, a.raw) : -1;
            if (swapped && swappedScore > bestScore) {
                bestScore = swappedScore;
                best = swapped;
            }
        }
    }

    return best;
}

function fromGrid(ll: { lat: number; lng: number } | null): LatLng | null {
    return ll ? asPair(ll.lat, ll.lng) : null;
}

/**
 * Pull a lat/lng pair out of mixed pasted text.
 * Accepts decimal degrees, geo: URIs, DMS, DDM, NMEA, MGRS/USNG, and UTM.
 */
export function parseLatLng(raw: string): LatLng | null {
    const text = normalize(raw);
    if (!text.trim()) return null;

    return fromGrid(findMgrs(text))
        || fromGrid(findUtm(text))
        || parseSexagesimal(text)
        || parseNmea(text)
        || parseGeoUri(text)
        || (looksSexagesimal(text) ? null : parseDecimal(text));
}
