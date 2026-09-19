/**
 * Quick Point Dropper — shared reactive state, map click handling,
 * CoT create/update, and server-backed favorites.
 */
import { reactive, watch } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import { normalize_geojson } from '@tak-ps/node-cot/normalize_geojson';
import { useMapStore } from '../../../src/stores/map.ts';
import IconsetManager from '../../../src/base/iconset.ts';
import Icon from '../../../src/base/icon.ts';
import {
    listFavorites,
    addFavorite,
    removeFavorite,
    type FavoriteIcon,
} from './favorites-client.ts';

export const ROUTE_NAME = 'home-menu-plugin-quick-point-dropper';
export const MENU_KEY = 'quick-point-dropper';
export const BOTTOM_BAR_KEY = 'qpd-bottom-bar';
export const FAVORITES_PACK = '__favorites__';
export const ALL_FOLDERS = '__all__';
export const UNGROUPED_FOLDER = '__ungrouped__';

const LS_LAST_PACK = 'cloudtak-qpd-lastIconset';
const LS_DETAILED = 'cloudtak-qpd-detailedView';

export interface IconPack {
    uid: string;
    name: string;
}

export interface DisplayIcon {
    iconset: string;
    path: string;
    name: string;
    key: string;
    url: string;
}

export interface EditingPoint {
    id: string;
    lng: number;
    lat: number;
    icon?: string;
}

export const state = reactive({
    loading: false,
    error: '' as string,
    dropping: false,
    writable: false,
    detailed: loadDetailed(),
    title: '',
    remarks: '',
    packs: [] as IconPack[],
    selectedPack: FAVORITES_PACK,
    selectedFolder: ALL_FOLDERS,
    icons: [] as DisplayIcon[],
    favorites: [] as FavoriteIcon[],
    selected: null as DisplayIcon | null,
    editing: null as EditingPoint | null,
});

function loadDetailed(): boolean {
    try {
        return localStorage.getItem(LS_DETAILED) === '1';
    } catch {
        return false;
    }
}

function loadLastPack(): string {
    try {
        return localStorage.getItem(LS_LAST_PACK) || FAVORITES_PACK;
    } catch {
        return FAVORITES_PACK;
    }
}

function saveLastPack(uid: string): void {
    try { localStorage.setItem(LS_LAST_PACK, uid); } catch { /* ignore */ }
}

export function setDetailed(value: boolean): void {
    state.detailed = value;
    try { localStorage.setItem(LS_DETAILED, value ? '1' : '0'); } catch { /* ignore */ }
}

function iconName(path: string): string {
    const segs = path.split('/').filter(Boolean);
    return segs[segs.length - 1] || path;
}

/** Top-level folder in an icon path, or '' when the icon sits at the pack root. */
export function iconFolder(path: string): string {
    const segs = path.split('/').filter(Boolean);
    return segs.length > 1 ? segs[0] : '';
}

export function packFolders(icons: DisplayIcon[]): string[] {
    const folders = new Set<string>();
    for (const icon of icons) {
        const folder = iconFolder(icon.path);
        if (folder) folders.add(folder);
    }
    return [...folders].sort((a, b) => a.localeCompare(b));
}

export function hasUngroupedIcons(icons: DisplayIcon[]): boolean {
    return icons.some((icon) => !iconFolder(icon.path));
}

/** Hide the folder dropdown when the pack has no subfolders. */
export function showFolderSelect(icons: DisplayIcon[]): boolean {
    return packFolders(icons).length >= 1;
}

export function visibleIcons(): DisplayIcon[] {
    if (!showFolderSelect(state.icons) || state.selectedFolder === ALL_FOLDERS) {
        return state.icons;
    }
    if (state.selectedFolder === UNGROUPED_FOLDER) {
        return state.icons.filter((icon) => !iconFolder(icon.path));
    }
    return state.icons.filter((icon) => iconFolder(icon.path) === state.selectedFolder);
}

export function selectFolder(folder: string): void {
    state.selectedFolder = folder;
}

function iconKey(iconset: string, path: string): string {
    return `${iconset}:${path}`;
}

let api: PluginAPI | null = null;
let thumbUrls: string[] = [];
let onDroppingChange: ((dropping: boolean) => void) | null = null;
let removeAfterEach: (() => void) | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let suppressSave = false;

function clearSaveTimer(): void {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
    }
}

async function persistEdit(): Promise<void> {
    if (!state.editing) return;
    const icon = state.selected?.key || state.editing.icon;
    if (!icon) return;
    try {
        await upsertCot({ ...state.editing, icon });
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    }
}

function scheduleEditSave(): void {
    if (suppressSave || !state.editing) return;
    clearSaveTimer();
    saveTimer = setTimeout(() => {
        saveTimer = undefined;
        void persistEdit();
    }, 400);
}

watch(() => state.title, scheduleEditSave);
watch(() => state.remarks, scheduleEditSave);

const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (!state.dropping) return;
    e.preventDefault();
    e.stopPropagation();
    stopDrop();
};

export function setDroppingListener(fn: ((dropping: boolean) => void) | null): void {
    onDroppingChange = fn;
}

function revokeThumbs(): void {
    for (const url of thumbUrls) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    thumbUrls = [];
}

function blobUrl(data: Blob): string {
    const url = URL.createObjectURL(data);
    thumbUrls.push(url);
    return url;
}

function setCursor(cursor: string): void {
    try {
        if (api) api.map.getCanvas().style.cursor = cursor;
    } catch { /* map not ready */ }
}

function clearRadial(): void {
    if (!api) return;
    try {
        const mapStore = useMapStore(api.pinia) as { radial?: { mode?: unknown } };
        if (mapStore.radial) mapStore.radial.mode = undefined;
    } catch { /* ignore */ }
}

function pluginRouteActive(): boolean {
    if (!api) return false;
    return api.router.currentRoute.value.name === ROUTE_NAME;
}

export function stopDrop(): void {
    const was = state.dropping;
    state.dropping = false;
    setCursor('');
    if (was) onDroppingChange?.(false);
}

function startDrop(): void {
    if (!state.selected) return;
    clearSaveTimer();
    state.editing = null;
    const was = state.dropping;
    state.dropping = true;
    setCursor('crosshair');
    if (!was) onDroppingChange?.(true);
}

export function selectIcon(icon: DisplayIcon): void {
    state.selected = icon;
    const target = state.editing;
    if (target) {
        clearSaveTimer();
        void upsertCot(target).catch((err) => {
            state.error = err instanceof Error ? err.message : String(err);
        });
    }
    startDrop();
}

export async function deletePoint(): Promise<void> {
    if (!api || !state.editing) return;
    const id = state.editing.id;
    clearSaveTimer();
    try {
        const mapStore = useMapStore(api.pinia);
        await mapStore.worker.db.remove(id);
        state.editing = null;
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    }
}

function cotUidFromClick(point: { x: number; y: number }): string | undefined {
    if (!api) return undefined;
    const hits = api.map.queryRenderedFeatures([point.x, point.y]);
    for (const f of hits) {
        const source = String(f.source || '');
        const layer = String(f.layer?.id || '');
        const props = (f.properties || {}) as Record<string, unknown>;
        const id = props.id ?? props.uid ?? f.id;
        if (typeof id !== 'string' || !id) continue;
        if (
            source.includes('cot')
            || layer.toLowerCase().includes('cot')
            || props.callsign !== undefined
            || props.type !== undefined
        ) {
            return id;
        }
    }
    return undefined;
}

async function getFeature(uid: string): Promise<{
    id?: string;
    properties?: Record<string, unknown>;
    geometry?: { type?: string; coordinates?: number[] };
} | null> {
    if (!api) return null;
    const list = await api.feature.list({
        filter: (f) => f.id === uid || String((f as { properties?: { id?: string } }).properties?.id) === uid
    });
    return (list[0] as typeof list[0] & {
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: number[] };
    }) ?? null;
}

async function upsertCot(opts: { id: string; lng: number; lat: number; icon?: string }): Promise<void> {
    if (!api) return;
    const icon = state.selected?.key || opts.icon;
    if (!icon) return;
    const mapStore = useMapStore(api.pinia);
    const callsign = state.title.trim() || state.selected?.name || 'Point';
    const remarks = state.remarks.trim();

    const feat = {
        id: opts.id,
        type: 'Feature' as const,
        path: '/',
        properties: {
            callsign,
            ...(remarks ? { remarks } : {}),
        },
        geometry: {
            type: 'Point' as const,
            coordinates: [opts.lng, opts.lat],
        },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const norm: any = await normalize_geojson(feat as any);
    norm.properties.type = 'u-d-p';
    norm.properties.how = 'h-g-i-g-o';
    norm.properties.icon = icon;
    norm.properties.archived = true;
    await mapStore.worker.db.add(JSON.parse(JSON.stringify(norm)), { authored: true });
}

async function beginEdit(uid: string): Promise<void> {
    const feat = await getFeature(uid);
    if (!feat) {
        state.error = 'Could not load that point';
        return;
    }

    const props = feat.properties || {};
    const geom = feat.geometry;
    if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
        state.error = 'That feature is not a point';
        return;
    }

    suppressSave = true;
    state.title = String(props.callsign || '');
    state.remarks = String(props.remarks || '');
    const icon = typeof props.icon === 'string' ? props.icon : '';
    state.editing = {
        id: String(feat.id || uid),
        lng: Number(geom.coordinates[0]),
        lat: Number(geom.coordinates[1]),
        icon: icon || undefined,
    };

    if (icon) {
        const sep = icon.indexOf(':');
        if (sep > 0) {
            const iconset = icon.slice(0, sep);
            const path = icon.slice(sep + 1);
            const match = state.icons.find((i) => i.key === icon);
            if (match) {
                state.selected = match;
            } else {
                const loaded = await displayFromDexie(iconset, path);
                if (loaded) state.selected = loaded;
            }
        }
    }
    queueMicrotask(() => {
        suppressSave = false;
    });
}

type MapClickEvent = {
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
};

const onMapClick = (e: MapClickEvent): void => {
    if (!pluginRouteActive()) return;

    if (state.dropping) {
        if (!state.selected) return;
        const id = crypto.randomUUID();
        void upsertCot({ id, lng: e.lngLat.lng, lat: e.lngLat.lat }).catch((err) => {
            state.error = err instanceof Error ? err.message : String(err);
        });
        clearRadial();
        return;
    }

    const uid = cotUidFromClick(e.point);
    if (!uid) return;
    void beginEdit(uid);
    clearRadial();
};

async function displayFromDexie(iconset: string, path: string): Promise<DisplayIcon | null> {
    try {
        const row = await Icon.get(iconKey(iconset, path));
        if (!row?.data) return null;
        return {
            iconset,
            path,
            name: iconName(path),
            key: iconKey(iconset, path),
            url: blobUrl(row.data as Blob),
        };
    } catch {
        return null;
    }
}

async function iconsForPack(uid: string): Promise<DisplayIcon[]> {
    let rows = await Icon.list(uid);
    if (!rows.length) {
        try {
            await Icon.addIconset(uid);
            rows = await Icon.list(uid);
        } catch (err) {
            console.warn('QPD: failed to hydrate iconset', uid, err);
        }
    }

    revokeThumbs();
    return rows.map((row) => ({
        iconset: row.iconset,
        path: row.path,
        name: iconName(row.path),
        key: row.name || iconKey(row.iconset, row.path),
        url: blobUrl(row.data as Blob),
    }));
}

async function iconsForFavorites(): Promise<DisplayIcon[]> {
    revokeThumbs();
    const out: DisplayIcon[] = [];
    for (const fav of state.favorites) {
        let icon = await displayFromDexie(fav.iconset, fav.path);
        if (!icon) {
            try {
                await Icon.addIconset(fav.iconset);
                icon = await displayFromDexie(fav.iconset, fav.path);
            } catch { /* missing pack */ }
        }
        if (icon) {
            icon.name = fav.name || icon.name;
            out.push(icon);
        } else {
            out.push({
                iconset: fav.iconset,
                path: fav.path,
                name: fav.name || iconName(fav.path),
                key: iconKey(fav.iconset, fav.path),
                url: '',
            });
        }
    }
    return out;
}

export async function selectPack(uid: string): Promise<void> {
    state.selectedPack = uid;
    state.selectedFolder = ALL_FOLDERS;
    saveLastPack(uid);
    state.loading = true;
    try {
        state.icons = uid === FAVORITES_PACK
            ? await iconsForFavorites()
            : await iconsForPack(uid);
        const folders = packFolders(state.icons);
        const ungrouped = hasUngroupedIcons(state.icons);
        state.selectedFolder = folders.length === 1 && !ungrouped
            ? folders[0]
            : ALL_FOLDERS;
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
        state.icons = [];
    } finally {
        state.loading = false;
    }
}

export function isFavorite(icon: { iconset: string; path: string }): boolean {
    return state.favorites.some((f) => f.iconset === icon.iconset && f.path === icon.path);
}

export async function toggleFavorite(icon: DisplayIcon): Promise<void> {
    if (!state.writable) return;
    const existed = isFavorite(icon);
    const prev = state.favorites.slice();
    const entry: FavoriteIcon = {
        iconset: icon.iconset,
        path: icon.path,
        name: icon.name,
    };

    if (existed) {
        state.favorites = state.favorites.filter((f) => !(f.iconset === icon.iconset && f.path === icon.path));
    } else {
        state.favorites = [...state.favorites, entry];
    }

    const selectedKey = state.selected?.key;
    if (state.selectedPack === FAVORITES_PACK) {
        await selectPack(FAVORITES_PACK);
        if (selectedKey) {
            state.selected = state.icons.find((i) => i.key === selectedKey) ?? state.selected;
        }
    }

    try {
        if (existed) {
            await removeFavorite(icon.iconset, icon.path);
        } else {
            await addFavorite(entry);
        }
    } catch (err) {
        state.favorites = prev;
        state.error = err instanceof Error ? err.message : String(err);
        if (state.selectedPack === FAVORITES_PACK) {
            await selectPack(FAVORITES_PACK);
            if (selectedKey) {
                state.selected = state.icons.find((i) => i.key === selectedKey) ?? state.selected;
            }
        }
    }
}

async function load(): Promise<void> {
    state.loading = true;
    state.error = '';
    try {
        const [packs, favs] = await Promise.all([
            IconsetManager.list(),
            listFavorites().catch((err) => {
                console.warn('QPD: failed to load favorites', err);
                return { favorites: [] as FavoriteIcon[], writable: false };
            }),
        ]);
        if (!api) return;

        state.packs = packs.map((p) => ({ uid: p.uid, name: p.name }));
        state.favorites = favs.favorites;
        state.writable = favs.writable;

        const last = loadLastPack();
        const packExists = last === FAVORITES_PACK || state.packs.some((p) => p.uid === last);
        await selectPack(packExists ? last : FAVORITES_PACK);
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    } finally {
        state.loading = false;
    }
}

export function init(pluginAPI: PluginAPI): void {
    if (api) {
        try { api.map.off('click', onMapClick as never); } catch { /* ignore */ }
        window.removeEventListener('keydown', onKeyDown, true);
        removeAfterEach?.();
        removeAfterEach = undefined;
    }

    api = pluginAPI;

    try {
        api.map.on('click', onMapClick as never);
    } catch (err) {
        console.warn('QPD: map click handler not attached yet', err);
    }

    window.addEventListener('keydown', onKeyDown, true);

    const unhook = api.router.afterEach((to) => {
        if (to.name !== ROUTE_NAME) stopDrop();
    });
    if (typeof unhook === 'function') removeAfterEach = unhook;

    void load();
}

export function destroy(): void {
    clearSaveTimer();
    stopDrop();
    removeAfterEach?.();
    removeAfterEach = undefined;
    try { api?.map.off('click', onMapClick as never); } catch { /* map not ready */ }
    window.removeEventListener('keydown', onKeyDown, true);
    setCursor('');
    revokeThumbs();
    api = null;
}
