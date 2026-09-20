import {
    formatCoordPair,
    parseCoordPair,
    type CoordMode,
} from '../../../src/utils/coordinateFormat.ts';

export type { CoordMode };

export function isCoordMode(value: unknown): value is CoordMode {
    return value === 'dd' || value === 'dm' || value === 'dms' || value === 'mgrs' || value === 'utm';
}

export function formatLatLng(lat: number, lng: number, mode: CoordMode = 'dd'): string {
    try {
        return formatCoordPair(lat, lng, mode);
    } catch {
        return `${lat}, ${lng}`;
    }
}

export function parseLatLng(raw: string): { lat: number; lng: number } | null {
    try {
        const [lat, lng] = parseCoordPair(raw.trim());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { lat, lng };
    } catch {
        return null;
    }
}
