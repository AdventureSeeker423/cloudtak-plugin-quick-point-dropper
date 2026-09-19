import { std } from '../../../src/std.ts';

export interface FavoriteIcon {
    iconset: string;
    path: string;
    name: string;
}

export interface FavoritesResponse {
    favorites: FavoriteIcon[];
    writable: boolean;
}

export async function listFavorites(): Promise<FavoritesResponse> {
    const r = await std('/api/qpd/favorites', { method: 'GET' }) as Partial<FavoritesResponse>;
    return {
        favorites: Array.isArray(r?.favorites) ? r.favorites : [],
        writable: !!r?.writable,
    };
}

export async function addFavorite(icon: FavoriteIcon): Promise<FavoriteIcon> {
    const r = await std('/api/qpd/favorites', {
        method: 'POST',
        body: icon,
    }) as { favorite: FavoriteIcon };
    return r.favorite;
}

export async function removeFavorite(iconset: string, path: string): Promise<void> {
    const q = new URLSearchParams({ iconset, path });
    await std(`/api/qpd/favorites?${q.toString()}`, { method: 'DELETE' });
}
