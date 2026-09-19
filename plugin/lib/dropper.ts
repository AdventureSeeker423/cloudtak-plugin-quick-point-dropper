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
    STANDARD_PACK,
    standardIcons,
    matchStandardType,
} from './standard-icons.ts';
import {
    listFavorites,
    addFavorite,
    removeFavorite,
    saveLayout,
    type FavoriteIcon,
    type FavoriteSection,
} from './favorites-client.ts';

export { STANDARD_PACK } from './standard-icons.ts';
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
    sectionId?: string | null;
    cotType?: string;
    legacyType?: string;
    keywords?: string;
}

export interface FavoriteGroup {
    id: string | null;
    name: string;
    icons: DisplayIcon[];
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
    selectedSection: ALL_FOLDERS,
    organizing: false,
    query: '',
    icons: [] as DisplayIcon[],
    favorites: [] as FavoriteIcon[],
    sections: [] as FavoriteSection[],
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

/** Hide the folder dropdown unless the pack has two or more subfolders. Favorites use sections instead. */
export function showFolderSelect(icons: DisplayIcon[]): boolean {
    if (state.selectedPack === FAVORITES_PACK || state.selectedPack === STANDARD_PACK) return false;
    return packFolders(icons).length >= 2;
}

export function iconMatchesQuery(icon: DisplayIcon): boolean {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    const hay = [icon.name, icon.path, icon.keywords, icon.cotType, icon.legacyType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

export function visibleIcons(): DisplayIcon[] {
    let icons = state.icons;
    if (showFolderSelect(state.icons) && state.selectedFolder !== ALL_FOLDERS) {
        if (state.selectedFolder === UNGROUPED_FOLDER) {
            icons = icons.filter((icon) => !iconFolder(icon.path));
        } else {
            icons = icons.filter((icon) => iconFolder(icon.path) === state.selectedFolder);
        }
    }
    return icons.filter(iconMatchesQuery);
}

export function selectFolder(folder: string): void {
    state.selectedFolder = folder;
}

export function selectSection(sectionId: string): void {
    state.selectedSection = sectionId;
}

export function setOrganizing(value: boolean): void {
    state.organizing = !!value && state.writable;
}

export function sortedSections(): FavoriteSection[] {
    return [...state.sections].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function hasUnsortedFavorites(): boolean {
    return state.favorites.some((f) => !f.sectionId);
}

/** Show a section filter when Favorites has more than one group. */
export function showSectionSelect(): boolean {
    if (state.selectedPack !== FAVORITES_PACK) return false;
    return state.sections.length > 1 || (state.sections.length === 1 && hasUnsortedFavorites());
}

export function favoriteGroups(): FavoriteGroup[] {
    const bySection = new Map<string, DisplayIcon[]>();
    const unsorted: DisplayIcon[] = [];
    const searching = !!state.query.trim();
    for (const icon of state.icons) {
        if (!iconMatchesQuery(icon)) continue;
        if (icon.sectionId) {
            const list = bySection.get(icon.sectionId) || [];
            list.push(icon);
            bySection.set(icon.sectionId, list);
        } else {
            unsorted.push(icon);
        }
    }

    const groups: FavoriteGroup[] = [];
    for (const section of sortedSections()) {
        const icons = bySection.get(section.id) || [];
        if (icons.length || (state.organizing && !searching)) {
            groups.push({ id: section.id, name: section.name, icons });
        }
    }
    if (state.sections.length && (unsorted.length || (state.organizing && !searching))) {
        groups.push({ id: null, name: 'Unsorted', icons: unsorted });
    } else if (!state.sections.length && unsorted.length) {
        groups.push({ id: null, name: '', icons: unsorted });
    }

    if (state.selectedSection === ALL_FOLDERS) return groups;
    if (state.selectedSection === UNGROUPED_FOLDER) {
        return groups.filter((g) => g.id === null);
    }
    return groups.filter((g) => g.id === state.selectedSection);
}

function favKey(iconset: string, path: string): string {
    return `${iconset}:${path}`;
}

function syncIconsFromFavorites(): void {
    const iconByKey = new Map(state.icons.map((i) => [i.key, i]));
    const next: DisplayIcon[] = [];
    for (const fav of state.favorites) {
        const icon = iconByKey.get(favKey(fav.iconset, fav.path));
        if (!icon) continue;
        icon.sectionId = fav.sectionId;
        icon.name = fav.name || icon.name;
        next.push(icon);
    }
    state.icons = next;
    if (state.selected) {
        const selectedKey = state.selected.key;
        state.selected = state.icons.find((i) => i.key === selectedKey) ?? state.selected;
    }
}

let layoutLock: Promise<void> = Promise.resolve();

function persistLayout(): Promise<void> {
    if (!state.writable) return Promise.resolve();
    const run = async (): Promise<void> => {
        const r = await saveLayout({
            sections: sortedSections().map((s) => ({ id: s.id, name: s.name })),
            items: state.favorites.map((f) => ({
                iconset: f.iconset,
                path: f.path,
                sectionId: f.sectionId || '',
            })),
        });
        state.sections = r.sections;
        state.favorites = r.favorites;
        syncIconsFromFavorites();
    };
    layoutLock = layoutLock.then(run, run).catch((err) => {
        state.error = err instanceof Error ? err.message : String(err);
    });
    return layoutLock;
}

export async function createSection(name: string): Promise<void> {
    if (!state.writable) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    state.sections = [
        ...sortedSections(),
        { id: crypto.randomUUID(), name: trimmed, sort: state.sections.length },
    ];
    await persistLayout();
}

export async function renameSection(id: string, name: string): Promise<void> {
    if (!state.writable) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    state.sections = state.sections.map((s) => (s.id === id ? { ...s, name: trimmed } : s));
    await persistLayout();
}

export async function deleteSection(id: string): Promise<void> {
    if (!state.writable) return;
    state.sections = state.sections.filter((s) => s.id !== id);
    state.favorites = state.favorites.map((f) => (
        f.sectionId === id ? { ...f, sectionId: null } : f
    ));
    if (state.selectedSection === id) state.selectedSection = ALL_FOLDERS;
    syncIconsFromFavorites();
    await persistLayout();
}

export async function moveSection(id: string, dir: -1 | 1): Promise<void> {
    if (!state.writable) return;
    const next = sortedSections();
    const i = next.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return;
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
    state.sections = next.map((s, sort) => ({ ...s, sort }));
    await persistLayout();
}

function sameFav(a: { iconset: string; path: string }, b: { iconset: string; path: string }): boolean {
    return a.iconset === b.iconset && a.path === b.path;
}

function lastIndexWhere<T>(arr: T[], pred: (item: T) => boolean): number {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (pred(arr[i])) return i;
    }
    return -1;
}

export async function moveIcon(icon: DisplayIcon, dir: -1 | 1): Promise<void> {
    if (!state.writable) return;
    const sectionId = icon.sectionId || null;
    const indexed = state.favorites.map((f, idx) => ({ f, idx }));
    const inSection = indexed.filter(({ f }) => (f.sectionId || null) === sectionId);
    const i = inSection.findIndex(({ f }) => sameFav(f, icon));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= inSection.length) return;
    const next = state.favorites.slice();
    const from = inSection[i].idx;
    const to = inSection[j].idx;
    const tmp = next[from];
    next[from] = next[to];
    next[to] = tmp;
    state.favorites = next.map((f, sort) => ({ ...f, sort }));
    syncIconsFromFavorites();
    await persistLayout();
}

export async function assignIconSection(icon: DisplayIcon, sectionId: string | null): Promise<void> {
    if (!state.writable) return;
    const current = state.favorites.find((f) => sameFav(f, icon));
    if (!current) return;
    const rest = state.favorites.filter((f) => !sameFav(f, icon));
    const entry: FavoriteIcon = { ...current, sectionId };
    let insertAt = lastIndexWhere(rest, (f) => (f.sectionId || null) === sectionId);
    if (insertAt < 0) {
        if (!sectionId) {
            insertAt = rest.length;
        } else {
            const sectionOrder = sortedSections().map((s) => s.id);
            const targetPos = sectionOrder.indexOf(sectionId);
            insertAt = rest.length;
            for (let i = rest.length - 1; i >= 0; i--) {
                const sid = rest[i].sectionId;
                if (!sid) continue;
                const pos = sectionOrder.indexOf(sid);
                if (pos >= 0 && pos <= targetPos) {
                    insertAt = i + 1;
                    break;
                }
                if (pos >= 0 && pos > targetPos) insertAt = i;
            }
        }
    } else {
        insertAt += 1;
    }
    rest.splice(insertAt, 0, entry);
    state.favorites = rest.map((f, sort) => ({ ...f, sort }));
    syncIconsFromFavorites();
    await persistLayout();
}

/** Place `icon` in `sectionId`, before `before` if given, otherwise at the end of the section. */
export async function placeIcon(
    icon: DisplayIcon,
    sectionId: string | null,
    before?: DisplayIcon | null,
): Promise<void> {
    if (!state.writable) return;
    if (before && before.key === icon.key) return;
    const current = state.favorites.find((f) => sameFav(f, icon));
    if (!current) return;
    const rest = state.favorites.filter((f) => !sameFav(f, icon));
    const entry: FavoriteIcon = { ...current, sectionId };
    let insertAt = rest.length;
    if (before) {
        const idx = rest.findIndex((f) => sameFav(f, before));
        if (idx >= 0) insertAt = idx;
    } else {
        const last = lastIndexWhere(rest, (f) => (f.sectionId || null) === sectionId);
        insertAt = last >= 0 ? last + 1 : rest.length;
    }
    rest.splice(insertAt, 0, entry);
    state.favorites = rest.map((f, sort) => ({ ...f, sort }));
    syncIconsFromFavorites();
    await persistLayout();
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
    if (!state.selected?.cotType && !(state.selected?.key || state.editing.icon)) return;
    try {
        await upsertCot({ ...state.editing, icon: state.selected?.key || state.editing.icon });
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

let preEdit: { title: string; remarks: string } | null = null;

function snapshotPreEdit(): void {
    if (state.editing || preEdit) return;
    preEdit = { title: state.title, remarks: state.remarks };
}

function restorePreEdit(): void {
    if (!preEdit) return;
    suppressSave = true;
    state.title = preEdit.title;
    state.remarks = preEdit.remarks;
    preEdit = null;
    queueMicrotask(() => {
        suppressSave = false;
    });
}

export async function cancelEdit(): Promise<void> {
    if (!state.editing) return;
    clearSaveTimer();
    try {
        await persistEdit();
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    }
    state.editing = null;
    restorePreEdit();
    if (state.selected) startDrop();
}

const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (!pluginRouteActive()) return;
    if (state.editing) {
        e.preventDefault();
        e.stopPropagation();
        void cancelEdit();
        return;
    }
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
    preEdit = null;
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
        preEdit = null;
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
    const selected = state.selected;
    const cotType = selected?.cotType;
    const icon = selected && !cotType ? selected.key : (!cotType ? opts.icon : undefined);
    if (!cotType && !icon) return;
    const mapStore = useMapStore(api.pinia);
    const callsign = state.title.trim() || selected?.name || 'Point';
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
    norm.properties.how = 'h-g-i-g-o';
    norm.properties.archived = true;
    if (cotType) {
        norm.properties.type = selected?.legacyType || cotType;
        norm.properties['marker-opacity'] = 1;
        delete norm.properties.icon;
    } else {
        norm.properties.type = 'u-d-p';
        norm.properties.icon = icon;
    }
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

    snapshotPreEdit();
    suppressSave = true;
    state.title = String(props.callsign || '');
    state.remarks = String(props.remarks || '');
    const icon = typeof props.icon === 'string' ? props.icon : '';
    const cotType = typeof props.type === 'string' ? props.type : '';
    state.editing = {
        id: String(feat.id || uid),
        lng: Number(geom.coordinates[0]),
        lat: Number(geom.coordinates[1]),
        icon: icon || undefined,
    };

    const standard = matchStandardType(cotType);
    if (standard) {
        state.selected = { ...standard };
    } else if (icon) {
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
    if (uid) {
        void beginEdit(uid);
        clearRadial();
        return;
    }
    if (state.editing) {
        void cancelEdit();
        clearRadial();
    }
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
        if (fav.iconset === STANDARD_PACK) {
            const std = standardIcons().find((i) => i.path === fav.path);
            if (std) {
                out.push({
                    ...std,
                    name: fav.name || std.name,
                    sectionId: fav.sectionId,
                });
            }
            continue;
        }
        let icon = await displayFromDexie(fav.iconset, fav.path);
        if (!icon) {
            try {
                await Icon.addIconset(fav.iconset);
                icon = await displayFromDexie(fav.iconset, fav.path);
            } catch { /* missing pack */ }
        }
        if (icon) {
            icon.name = fav.name || icon.name;
            icon.sectionId = fav.sectionId;
            out.push(icon);
        } else {
            out.push({
                iconset: fav.iconset,
                path: fav.path,
                name: fav.name || iconName(fav.path),
                key: iconKey(fav.iconset, fav.path),
                url: '',
                sectionId: fav.sectionId,
            });
        }
    }
    return out;
}

export async function selectPack(uid: string): Promise<void> {
    state.selectedPack = uid;
    state.selectedFolder = ALL_FOLDERS;
    state.selectedSection = ALL_FOLDERS;
    if (uid !== FAVORITES_PACK) state.organizing = false;
    saveLastPack(uid);
    state.loading = true;
    try {
        if (uid === FAVORITES_PACK) {
            state.icons = await iconsForFavorites();
        } else if (uid === STANDARD_PACK) {
            revokeThumbs();
            state.icons = standardIcons();
        } else {
            state.icons = await iconsForPack(uid);
        }
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
        sectionId: null,
        sort: state.favorites.reduce((max, f) => Math.max(max, f.sort), -1) + 1,
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
                return { favorites: [] as FavoriteIcon[], sections: [] as FavoriteSection[], writable: false };
            }),
        ]);
        if (!api) return;

        state.packs = packs.map((p) => ({ uid: p.uid, name: p.name }));
        state.favorites = favs.favorites;
        state.sections = favs.sections;
        state.writable = favs.writable;
        if (!state.writable) state.organizing = false;

        const last = loadLastPack();
        const packExists = last === FAVORITES_PACK
            || last === STANDARD_PACK
            || state.packs.some((p) => p.uid === last);
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
        if (to.name !== ROUTE_NAME) {
            stopDrop();
            clearSaveTimer();
            state.editing = null;
            preEdit = null;
        }
    });
    if (typeof unhook === 'function') removeAfterEach = unhook;

    void load();
}

export function destroy(): void {
    clearSaveTimer();
    stopDrop();
    state.editing = null;
    preEdit = null;
    removeAfterEach?.();
    removeAfterEach = undefined;
    try { api?.map.off('click', onMapClick as never); } catch { /* map not ready */ }
    window.removeEventListener('keydown', onKeyDown, true);
    setCursor('');
    revokeThumbs();
    api = null;
}
