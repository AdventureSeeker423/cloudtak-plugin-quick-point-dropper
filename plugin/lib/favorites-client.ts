import { std } from '../../../src/std.ts';

export interface FavoriteIcon {
    iconset: string;
    path: string;
    name: string;
    sectionId: string | null;
    sort: number;
}

export interface FavoriteSection {
    id: string;
    name: string;
    sort: number;
}

export interface FavoritesResponse {
    sections: FavoriteSection[];
    favorites: FavoriteIcon[];
    writable: boolean;
}

export interface LayoutPayload {
    sections: { id: string; name: string }[];
    items: { iconset: string; path: string; sectionId: string }[];
}

function asSection(raw: unknown): FavoriteSection | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const id = String(row.id || '').trim();
    const name = String(row.name || '').trim();
    if (!id || !name) return null;
    return { id, name, sort: Number(row.sort) || 0 };
}

function asFavorite(raw: unknown): FavoriteIcon | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const iconset = String(row.iconset || '').trim();
    const path = String(row.path || '').trim();
    if (!iconset || !path) return null;
    const sectionId = String(row.sectionId || row.section_id || '').trim();
    return {
        iconset,
        path,
        name: String(row.name || '').trim() || path,
        sectionId: sectionId || null,
        sort: Number(row.sort) || 0,
    };
}

function parseLayout(raw: unknown): Pick<FavoritesResponse, 'sections' | 'favorites'> {
    const row = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    return {
        sections: Array.isArray(row.sections)
            ? row.sections.map(asSection).filter((s): s is FavoriteSection => !!s)
            : [],
        favorites: Array.isArray(row.favorites)
            ? row.favorites.map(asFavorite).filter((f): f is FavoriteIcon => !!f)
            : [],
    };
}

export async function listFavorites(): Promise<FavoritesResponse> {
    const r = await std('/api/qpd/favorites', { method: 'GET' }) as Partial<FavoritesResponse> & {
        favorites?: unknown[];
        sections?: unknown[];
    };
    const layout = parseLayout(r);
    return {
        ...layout,
        writable: !!r?.writable,
    };
}

export async function addFavorite(icon: {
    iconset: string;
    path: string;
    name: string;
    sectionId?: string | null;
}): Promise<FavoriteIcon> {
    const r = await std('/api/qpd/favorites', {
        method: 'POST',
        body: {
            iconset: icon.iconset,
            path: icon.path,
            name: icon.name,
            ...(icon.sectionId ? { sectionId: icon.sectionId } : {}),
        },
    }) as { favorite: unknown };
    const favorite = asFavorite(r.favorite);
    if (!favorite) {
        return {
            iconset: icon.iconset,
            path: icon.path,
            name: icon.name,
            sectionId: icon.sectionId || null,
            sort: 0,
        };
    }
    return favorite;
}

export async function removeFavorite(iconset: string, path: string): Promise<void> {
    const q = new URLSearchParams({ iconset, path });
    await std(`/api/qpd/favorites?${q.toString()}`, { method: 'DELETE' });
}

export async function saveLayout(payload: LayoutPayload): Promise<Pick<FavoritesResponse, 'sections' | 'favorites'>> {
    const r = await std('/api/qpd/layout', {
        method: 'POST',
        body: payload,
    });
    return parseLayout(r);
}
