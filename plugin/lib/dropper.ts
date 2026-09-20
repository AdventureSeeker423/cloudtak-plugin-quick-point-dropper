/**
 * Quick Point Dropper — shared reactive state, map click handling,
 * CoT create/update, and server-backed favorites.
 */
import { reactive, watch, nextTick } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import { normalize_geojson } from '@tak-ps/node-cot/normalize_geojson';
import { useMapStore } from '../../../src/stores/map.ts';
import OverlayManager from '../../../src/base/overlay.ts';
import IconsetManager from '../../../src/base/iconset.ts';
import Icon from '../../../src/base/icon.ts';
import {
    STANDARD_PACK,
    standardIcons,
    matchStandardType,
} from './standard-icons.ts';
import { parseLatLng, formatLatLng, isCoordMode, type CoordMode } from './coords.ts';
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
    cotType?: string;
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
    editTab: 'add' as 'add' | 'arrange',
    query: '',
    libraryPack: STANDARD_PACK,
    libraryFolder: ALL_FOLDERS,
    libraryQuery: '',
    libraryLoading: false,
    libraryIcons: [] as DisplayIcon[],
    icons: [] as DisplayIcon[],
    favorites: [] as FavoriteIcon[],
    sections: [] as FavoriteSection[],
    selected: null as DisplayIcon | null,
    editing: null as EditingPoint | null,
    moving: false,
    changingIcon: false,
    enumerate: false,
    enumerateNext: 1,
    coordFormat: 'dd' as CoordMode,
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

/** First letter of each word capitalized when the Title field is empty. */
function toTitleCase(raw: string): string {
    const base = raw.replace(/\.[a-z0-9]{2,4}$/i, '').trim();
    if (!base) return raw;
    return base
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function iconLabel(icon: { name?: string; path?: string }): string {
    const preferred = icon.name && !icon.name.includes('/')
        ? icon.name
        : (icon.path || icon.name || '');
    return toTitleCase(iconName(preferred) || preferred);
}

export function defaultCallsign(icon?: DisplayIcon | null): string {
    if (!icon) return '';
    return iconLabel(icon) || 'Point';
}

export function enumeratedCallsign(stem: string): string {
    const raw = state.title;
    const base = raw.trim() ? raw : stem;
    const prefix = base.endsWith(' ') ? base : `${base} `;
    return `${prefix}${state.enumerateNext}`;
}

export function setEnumerate(value: boolean): void {
    state.enumerate = !!value;
}

export function setEnumerateNext(value: number): void {
    if (!Number.isFinite(value)) {
        state.enumerateNext = 0;
        return;
    }
    state.enumerateNext = Math.max(0, Math.floor(value));
}

export function resetEnumerate(): void {
    state.enumerateNext = 1;
}

export function bumpEnumerate(): void {
    state.enumerateNext += 1;
}

function remarksText(raw: unknown): string {
    const text = String(raw ?? '').trim();
    if (!text || /^none$/i.test(text)) return '';
    return text;
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

export function iconMatchesQuery(icon: DisplayIcon, query?: string): boolean {
    const q = (query ?? state.query).trim().toLowerCase();
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
    return icons.filter((icon) => iconMatchesQuery(icon));
}

export function selectFolder(folder: string): void {
    state.selectedFolder = folder;
}

export function selectSection(sectionId: string): void {
    state.selectedSection = sectionId;
}

let packBeforeEdit = FAVORITES_PACK;

export function setEditTab(tab: 'add' | 'arrange'): void {
    state.editTab = tab;
    if (tab === 'arrange' && state.selectedPack === FAVORITES_PACK) {
        void refreshFavoriteIcons();
    }
}

async function refreshFavoriteIcons(): Promise<void> {
    try {
        const icons = await iconsForFavorites();
        if (state.organizing && state.editTab === 'arrange') {
            state.icons = icons;
        }
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    }
}

export function setOrganizing(value: boolean): void {
    const next = !!value && state.writable;
    if (next === state.organizing) return;
    if (next) {
        packBeforeEdit = state.selectedPack;
        stopDrop();
        stopMove();
        stopChangeIcon();
        clearSaveTimer();
        state.editing = null;
        preEdit = null;
        state.selected = null;
        state.selectedSection = ALL_FOLDERS;
        state.editTab = state.favorites.length ? 'arrange' : 'add';
        state.organizing = true;
        void (async () => {
            await selectPack(FAVORITES_PACK, { remember: false });
            const lib = packBeforeEdit === FAVORITES_PACK ? STANDARD_PACK : packBeforeEdit;
            await loadLibrary(lib);
        })();
        return;
    }
    state.organizing = false;
    void selectPack(packBeforeEdit);
}

export function showLibraryFolderSelect(): boolean {
    return packFolders(state.libraryIcons).length >= 2;
}

export function visibleLibraryIcons(): DisplayIcon[] {
    let icons = state.libraryIcons;
    if (showLibraryFolderSelect() && state.libraryFolder !== ALL_FOLDERS) {
        if (state.libraryFolder === UNGROUPED_FOLDER) {
            icons = icons.filter((icon) => !iconFolder(icon.path));
        } else {
            icons = icons.filter((icon) => iconFolder(icon.path) === state.libraryFolder);
        }
    }
    return icons.filter((icon) => iconMatchesQuery(icon, state.libraryQuery));
}

export function selectLibraryFolder(folder: string): void {
    state.libraryFolder = folder;
}

export function sortedSections(): FavoriteSection[] {
    return [...state.sections].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function hasUnsortedFavorites(): boolean {
    return state.favorites.some((f) => !f.sectionId);
}

/** Show a section filter when Favorites has more than one group. */
export function showSectionSelect(): boolean {
    if (state.selectedPack !== FAVORITES_PACK || state.organizing) return false;
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

function iconFavKey(icon: { iconset: string; path: string }): string {
    return favKey(icon.iconset, icon.path);
}

function syncIconsFromFavorites(): void {
    const iconByFav = new Map(state.icons.map((i) => [iconFavKey(i), i]));
    const next: DisplayIcon[] = [];
    for (const fav of state.favorites) {
        const icon = iconByFav.get(favKey(fav.iconset, fav.path));
        if (!icon) continue;
        icon.sectionId = fav.sectionId;
        icon.name = fav.name || icon.name;
        next.push(icon);
    }
    state.icons = next;
    if (state.selected) {
        const selectedKey = state.selected.key;
        const selectedFav = iconFavKey(state.selected);
        state.selected = state.icons.find((i) => i.key === selectedKey || iconFavKey(i) === selectedFav)
            ?? state.selected;
    }
}

let layoutLock: Promise<void> = Promise.resolve();

function persistLayout(): Promise<void> {
    if (!state.writable) return Promise.resolve();
    const run = async (): Promise<void> => {
        await saveLayout({
            sections: sortedSections().map((s) => ({ id: s.id, name: s.name })),
            items: state.favorites.map((f) => ({
                iconset: f.iconset,
                path: f.path,
                sectionId: f.sectionId || '',
            })),
        });
    };
    layoutLock = layoutLock.then(run, run).catch((err) => {
        state.error = err instanceof Error ? err.message : String(err);
        if (state.selectedPack === FAVORITES_PACK) {
            void selectPack(FAVORITES_PACK);
        }
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
const thumbUrls: string[] = [];
const libraryThumbs: string[] = [];
let onDroppingChange: ((dropping: boolean) => void) | null = null;
let removeAfterEach: (() => void) | undefined;
let stopMapStoreWatch: (() => void) | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let suppressSave = false;
let preEdit: { title: string; remarks: string } | null = null;
let titleInputEl: HTMLInputElement | null = null;

export function bindTitleInput(el: HTMLInputElement | null): void {
    titleInputEl = el;
}

function focusTitleInput(): void {
    if (!titleInputEl || state.organizing) return;
    void nextTick(() => {
        titleInputEl?.focus({ preventScroll: true });
    });
}

function clearSaveTimer(): void {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
    }
}

async function persistEdit(): Promise<void> {
    if (!state.editing) return;
    if (!state.editing.cotType && !state.editing.icon) return;
    try {
        await upsertCot({ ...state.editing });
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
    stopMove();
    stopChangeIcon();
    clearSaveTimer();
    try {
        await persistEdit();
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    }
    state.editing = null;
    state.selected = null;
    restorePreEdit();
}

export function clearSelection(): void {
    if (state.organizing) return;
    stopDrop();
    stopMove();
    stopChangeIcon();
    clearSaveTimer();
    state.editing = null;
    preEdit = null;
    suppressSave = true;
    state.title = '';
    state.remarks = '';
    state.selected = null;
    queueMicrotask(() => {
        suppressSave = false;
    });
}

function blurMapFocus(): void {
    try {
        for (const el of mapCursorEls()) {
            if (document.activeElement === el) el.blur();
        }
    } catch { /* ignore */ }
}

const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (!pluginRouteActive()) return;
    if (state.moving) {
        e.preventDefault();
        e.stopImmediatePropagation();
        stopMove();
        blurMapFocus();
        return;
    }
    if (state.changingIcon) {
        e.preventDefault();
        e.stopImmediatePropagation();
        stopChangeIcon();
        blurMapFocus();
        return;
    }
    if (state.editing) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void cancelEdit();
        blurMapFocus();
        return;
    }
    if (state.organizing) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setOrganizing(false);
        blurMapFocus();
        return;
    }
    if (!state.dropping) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearSelection();
    blurMapFocus();
};

export function setDroppingListener(fn: ((dropping: boolean) => void) | null): void {
    onDroppingChange = fn;
}

function revokeUrls(urls: string[]): void {
    for (const url of urls) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    urls.length = 0;
}

function revokeThumbs(): void {
    revokeUrls(thumbUrls);
}

function revokeLibraryThumbs(): void {
    revokeUrls(libraryThumbs);
}

function blobUrl(data: Blob, bucket: string[] = thumbUrls): string {
    const url = URL.createObjectURL(data);
    bucket.push(url);
    return url;
}

function setCursor(cursor: string): void {
    try {
        if (api) api.map.getCanvas().style.cursor = cursor;
    } catch { /* map not ready */ }
}

function dropCursorActive(): boolean {
    return state.dropping || state.moving;
}

function ensureCursorStyle(): void {
    if (document.getElementById('qpd-cursor-style')) return;
    const el = document.createElement('style');
    el.id = 'qpd-cursor-style';
    el.textContent = '.qpd-crosshair,.qpd-crosshair *{cursor:crosshair !important;}';
    document.head.appendChild(el);
}

function ensureMapFocusStyle(): void {
    if (document.getElementById('qpd-map-focus-style')) return;
    const el = document.createElement('style');
    el.id = 'qpd-map-focus-style';
    el.textContent = [
        '.maplibregl-canvas:focus,.maplibregl-canvas:focus-visible,',
        '.mapboxgl-canvas:focus,.mapboxgl-canvas:focus-visible,',
        '.maplibregl-map:focus,.maplibregl-map:focus-visible,',
        '.maplibregl-canvas-container:focus{',
        'outline:none !important;box-shadow:none !important;',
        '}',
    ].join('');
    document.head.appendChild(el);
}

function mapCursorEls(): HTMLElement[] {
    if (!api) return [];
    const els: HTMLElement[] = [];
    const map = api.map as {
        getCanvas?: () => HTMLElement;
        getCanvasContainer?: () => HTMLElement;
        getContainer?: () => HTMLElement;
    };
    try {
        const canvas = map.getCanvas?.();
        if (canvas) els.push(canvas);
    } catch { /* ignore */ }
    try {
        const wrap = map.getCanvasContainer?.();
        if (wrap) els.push(wrap);
    } catch { /* ignore */ }
    try {
        const box = map.getContainer?.();
        if (box) els.push(box);
    } catch { /* ignore */ }
    return els;
}

function applyDropCursor(): void {
    const on = dropCursorActive();
    try {
        if (on) ensureCursorStyle();
        for (const el of mapCursorEls()) {
            el.classList.toggle('qpd-crosshair', on);
        }
        setCursor(on ? 'crosshair' : '');
    } catch { /* map not ready */ }
}

const onMapMouseMove = (): void => {
    if (dropCursorActive()) applyDropCursor();
};

function clearRadial(): void {
    if (!api) return;
    try {
        const mapStore = useMapStore(api.pinia) as {
            radial?: { mode?: unknown; cot?: unknown };
        };
        if (mapStore.radial) {
            mapStore.radial.mode = undefined;
            mapStore.radial.cot = undefined;
        }
    } catch { /* ignore */ }
}

function clearSelectMenu(): void {
    if (!api) return;
    try {
        const mapStore = useMapStore(api.pinia) as { select?: { feats?: unknown[] } };
        if (mapStore.select?.feats?.length) mapStore.select.feats = [];
    } catch { /* ignore */ }
}

function suppressCloudtakUi(): void {
    clearRadial();
    clearSelectMenu();
}

type MapStoreUi = {
    radial: {
        mode?: string;
        cot?: { id?: string; properties?: { id?: string } };
    };
    select: { feats: unknown[] };
    coordFormat?: string;
};

function bindMapStoreWatch(): void {
    stopMapStoreWatch?.();
    stopMapStoreWatch = undefined;
    if (!api) return;
    const mapStore = useMapStore(api.pinia) as MapStoreUi;
    if (isCoordMode(mapStore.coordFormat)) state.coordFormat = mapStore.coordFormat;
    stopMapStoreWatch = watch(
        () => [mapStore.radial.mode, mapStore.select.feats?.length ?? 0, mapStore.coordFormat] as const,
        ([mode, featCount, coordFormat]) => {
            if (isCoordMode(coordFormat)) state.coordFormat = coordFormat;
            if (!pluginRouteActive() || state.organizing) return;
            if (dropCursorActive()) {
                if (mode) clearRadial();
                if (featCount) clearSelectMenu();
                return;
            }
            if (!mode || mode === 'context') return;
            if (mode !== 'cot') return;
            const cot = mapStore.radial.cot;
            const id = String(cot?.properties?.id || cot?.id || '');
            clearRadial();
            if (id) void beginEdit(id);
        }
    );
}

function pluginRouteActive(): boolean {
    if (!api) return false;
    return api.router.currentRoute.value.name === ROUTE_NAME;
}

export function stopDrop(): void {
    const was = state.dropping;
    state.dropping = false;
    applyDropCursor();
    if (was) onDroppingChange?.(false);
}

export function stopMove(): void {
    if (!state.moving) return;
    state.moving = false;
    applyDropCursor();
    if (!state.dropping) onDroppingChange?.(false);
}

export function startMove(): void {
    if (!state.editing || state.organizing) return;
    stopDrop();
    stopChangeIcon();
    const was = state.moving;
    state.moving = true;
    applyDropCursor();
    if (!was) onDroppingChange?.(true);
}

export function toggleMove(): void {
    if (state.moving) stopMove();
    else startMove();
}

export function stopChangeIcon(): void {
    state.changingIcon = false;
}

export function startChangeIcon(): void {
    if (!state.editing || state.organizing) return;
    stopDrop();
    stopMove();
    state.changingIcon = true;
}

export function toggleChangeIcon(): void {
    if (state.changingIcon) stopChangeIcon();
    else startChangeIcon();
}

function startDrop(): void {
    if (!state.selected) return;
    stopMove();
    stopChangeIcon();
    clearSaveTimer();
    state.editing = null;
    preEdit = null;
    const was = state.dropping;
    state.dropping = true;
    applyDropCursor();
    if (!was) onDroppingChange?.(true);
}

export function selectIcon(icon: DisplayIcon): void {
    if (state.organizing) return;
    if (state.changingIcon && state.editing) {
        state.selected = icon;
        const target = state.editing;
        clearSaveTimer();
        void upsertCot({ ...target, replaceIcon: true }).then(() => {
            stopChangeIcon();
        }).catch((err) => {
            state.error = err instanceof Error ? err.message : String(err);
        });
        return;
    }
    const changed = state.selected?.key !== icon.key;
    state.selected = icon;
    if (changed) {
        suppressSave = true;
        state.title = '';
        resetEnumerate();
        queueMicrotask(() => {
            suppressSave = false;
        });
    }
    if (state.editing) {
        clearSaveTimer();
        void persistEdit();
    }
    startDrop();
    focusTitleInput();
}

export async function deletePoint(): Promise<void> {
    if (!api || !state.editing) return;
    const id = state.editing.id;
    stopMove();
    clearSaveTimer();
    try {
        const mapStore = useMapStore(api.pinia);
        await mapStore.worker.db.remove(id);
        clearSelection();
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
    }
}

function uniqueClickIds(point: { x: number; y: number }): string[] {
    if (!api) return [];
    const hits = api.map.queryRenderedFeatures([point.x, point.y]);
    let clickMap: Map<string, { type: string }> | undefined;
    try {
        clickMap = OverlayManager.clickableLayerMap();
    } catch { /* overlay manager not ready */ }
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const f of hits) {
        const layer = String(f.layer?.id || '');
        if (clickMap && clickMap.size > 0 && !clickMap.has(layer)) continue;
        const props = (f.properties || {}) as Record<string, unknown>;
        const id = props.id ?? props.uid ?? f.id;
        if (typeof id !== 'string' || !id || seen.has(id)) continue;
        if (!clickMap || clickMap.size === 0) {
            const source = String(f.source || '');
            if (
                !source.includes('cot')
                && !layer.toLowerCase().includes('cot')
                && props.callsign === undefined
                && props.type === undefined
            ) {
                continue;
            }
        }
        seen.add(id);
        ids.push(id);
    }
    return ids;
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

async function upsertCot(opts: {
    id: string;
    lng: number;
    lat: number;
    icon?: string;
    enumerate?: boolean;
    replaceIcon?: boolean;
}): Promise<void> {
    if (!api) return;
    const selected = state.selected;
    const preserve = !opts.replaceIcon && state.editing?.id === opts.id;
    let useType: string | undefined;
    let useIcon: string | undefined;
    if (preserve) {
        useType = state.editing?.cotType;
        useIcon = state.editing?.icon;
    } else {
        useType = selected?.cotType;
        useIcon = selected && !selected.cotType
            ? selected.key
            : (!selected?.cotType ? opts.icon : undefined);
    }
    if (!useType && !useIcon) return;
    const mapStore = useMapStore(api.pinia);
    const stem = state.title.trim() || defaultCallsign(selected) || 'Point';
    const callsign = opts.enumerate ? enumeratedCallsign(stem) : stem;
    const remarks = remarksText(state.remarks);

    const feat = {
        id: opts.id,
        type: 'Feature' as const,
        path: '/',
        properties: {
            callsign,
            remarks,
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
    norm.properties.remarks = remarks;
    if (preserve) {
        if (useType) norm.properties.type = useType;
        if (useIcon) {
            norm.properties.icon = useIcon;
        } else {
            delete norm.properties.icon;
            if (useType && useType !== 'u-d-p') {
                norm.properties['marker-opacity'] = 1;
            }
        }
    } else if (selected?.cotType) {
        norm.properties.type = selected.legacyType || selected.cotType;
        norm.properties['marker-opacity'] = 1;
        delete norm.properties.icon;
    } else {
        norm.properties.type = 'u-d-p';
        norm.properties.icon = useIcon;
    }
    await mapStore.worker.db.add(JSON.parse(JSON.stringify(norm)), { authored: true });
    if (opts.replaceIcon && state.editing && selected) {
        if (selected.cotType) {
            state.editing.icon = undefined;
            state.editing.cotType = selected.legacyType || selected.cotType;
        } else {
            state.editing.icon = selected.key;
            state.editing.cotType = 'u-d-p';
        }
    }
    if (opts.enumerate) bumpEnumerate();
}

function panToIfNeeded(lng: number, lat: number): void {
    const map = api?.map as {
        getBounds?: () => { contains?: (pt: [number, number]) => boolean };
        panTo?: (pt: [number, number]) => void;
        flyTo?: (opts: { center: [number, number] }) => void;
    } | undefined;
    if (!map) return;
    try {
        const pt: [number, number] = [lng, lat];
        if (map.getBounds?.()?.contains?.(pt)) return;
        if (map.panTo) map.panTo(pt);
        else map.flyTo?.({ center: pt });
    } catch { /* map not ready */ }
}

export function formatCoords(lat: number, lng: number): string {
    return formatLatLng(lat, lng, state.coordFormat);
}

/** Drop or move using coordinates in CloudTAK's DD / DM / DMS / MGRS / UTM formats. */
export async function applyCoords(raw: string): Promise<{ ok: boolean; text: string; error: string }> {
    const canDrop = state.dropping && !!state.selected;
    const canMove = state.moving && !!state.editing;
    if (state.organizing || (!canDrop && !canMove)) {
        return { ok: false, text: raw, error: '' };
    }

    const parsed = parseLatLng(raw);
    if (!parsed) {
        const error = raw.trim() ? 'No coordinates found' : '';
        if (error) state.error = error;
        return { ok: false, text: raw, error };
    }

    const formatted = formatCoords(parsed.lat, parsed.lng);
    state.error = '';

    try {
        if (canMove && state.editing) {
            state.editing.lng = parsed.lng;
            state.editing.lat = parsed.lat;
            await upsertCot({ ...state.editing });
            panToIfNeeded(parsed.lng, parsed.lat);
            stopMove();
            return { ok: true, text: formatted, error: '' };
        }

        await upsertCot({
            id: crypto.randomUUID(),
            lng: parsed.lng,
            lat: parsed.lat,
            enumerate: state.enumerate,
        });
        panToIfNeeded(parsed.lng, parsed.lat);
        return { ok: true, text: '', error: '' };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        state.error = error;
        return { ok: false, text: formatted, error };
    }
}

async function beginEdit(uid: string): Promise<void> {
    stopMove();
    stopChangeIcon();
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
    state.remarks = remarksText(props.remarks);
    const icon = typeof props.icon === 'string' ? props.icon : '';
    const cotType = typeof props.type === 'string' ? props.type : '';
    state.editing = {
        id: String(feat.id || uid),
        lng: Number(geom.coordinates[0]),
        lat: Number(geom.coordinates[1]),
        icon: icon || undefined,
        cotType: cotType || undefined,
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
                state.selected = loaded;
            }
        } else {
            state.selected = null;
        }
    } else {
        state.selected = null;
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
    if (!pluginRouteActive() || state.organizing) return;

    if (state.moving && state.editing) {
        const target = {
            ...state.editing,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
        };
        state.editing.lng = target.lng;
        state.editing.lat = target.lat;
        void upsertCot(target).then(() => {
            stopMove();
        }).catch((err) => {
            state.error = err instanceof Error ? err.message : String(err);
        });
        suppressCloudtakUi();
        return;
    }

    if (state.dropping) {
        if (!state.selected) return;
        const id = crypto.randomUUID();
        void upsertCot({
            id,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
            enumerate: state.enumerate,
        }).then(() => {
            applyDropCursor();
            requestAnimationFrame(applyDropCursor);
            suppressCloudtakUi();
        }).catch((err) => {
            state.error = err instanceof Error ? err.message : String(err);
        });
        suppressCloudtakUi();
        applyDropCursor();
        return;
    }

    const ids = uniqueClickIds(e.point);
    if (ids.length > 1) {
        clearRadial();
        return;
    }
    if (ids.length === 1) {
        void beginEdit(ids[0]);
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

async function iconsForPack(uid: string, bucket: string[] = thumbUrls): Promise<DisplayIcon[]> {
    let rows = await Icon.list(uid);
    if (!rows.length) {
        try {
            await Icon.addIconset(uid);
            rows = await Icon.list(uid);
        } catch (err) {
            console.warn('QPD: failed to hydrate iconset', uid, err);
        }
    }

    revokeUrls(bucket);
    return rows.map((row) => ({
        iconset: row.iconset,
        path: row.path,
        name: iconName(row.path),
        key: row.name || iconKey(row.iconset, row.path),
        url: blobUrl(row.data as Blob, bucket),
    }));
}

async function displayFavorite(fav: FavoriteIcon): Promise<DisplayIcon> {
    if (fav.iconset === STANDARD_PACK) {
        const std = standardIcons().find((i) => i.path === fav.path);
        if (std) {
            return { ...std, name: fav.name || std.name, sectionId: fav.sectionId };
        }
    }
    let icon = await displayFromDexie(fav.iconset, fav.path);
    if (!icon) {
        try {
            await Icon.addIconset(fav.iconset);
            icon = await displayFromDexie(fav.iconset, fav.path);
        } catch { /* missing pack */ }
    }
    if (icon) {
        return { ...icon, name: fav.name || icon.name, sectionId: fav.sectionId };
    }
    return {
        iconset: fav.iconset,
        path: fav.path,
        name: fav.name || iconName(fav.path),
        key: iconKey(fav.iconset, fav.path),
        url: '',
        sectionId: fav.sectionId,
    };
}

async function iconsForFavorites(): Promise<DisplayIcon[]> {
    revokeThumbs();
    const out: DisplayIcon[] = [];
    for (const fav of state.favorites) {
        out.push(await displayFavorite(fav));
    }
    return out;
}

export async function selectPack(uid: string, opts?: { remember?: boolean }): Promise<void> {
    state.selectedPack = uid;
    state.selectedFolder = ALL_FOLDERS;
    state.selectedSection = ALL_FOLDERS;
    if (uid !== FAVORITES_PACK && !state.organizing) state.organizing = false;
    if (opts?.remember !== false) saveLastPack(uid);
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

export async function loadLibrary(uid: string): Promise<void> {
    const pack = uid === FAVORITES_PACK ? STANDARD_PACK : uid;
    state.libraryPack = pack;
    state.libraryFolder = ALL_FOLDERS;
    state.libraryLoading = true;
    try {
        if (pack === STANDARD_PACK) {
            revokeLibraryThumbs();
            state.libraryIcons = standardIcons();
        } else {
            state.libraryIcons = await iconsForPack(pack, libraryThumbs);
        }
        const folders = packFolders(state.libraryIcons);
        const ungrouped = hasUngroupedIcons(state.libraryIcons);
        state.libraryFolder = folders.length === 1 && !ungrouped
            ? folders[0]
            : ALL_FOLDERS;
    } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
        state.libraryIcons = [];
    } finally {
        state.libraryLoading = false;
    }
}

export function isFavorite(icon: { iconset: string; path: string }): boolean {
    return state.favorites.some((f) => f.iconset === icon.iconset && f.path === icon.path);
}

export async function toggleFavorite(icon: DisplayIcon): Promise<void> {
    if (!state.writable) return;
    const existed = isFavorite(icon);
    const prevFavs = state.favorites.slice();
    const prevIcons = state.icons.slice();
    const entry: FavoriteIcon = {
        iconset: icon.iconset,
        path: icon.path,
        name: icon.name,
        sectionId: null,
        sort: state.favorites.reduce((max, f) => Math.max(max, f.sort), -1) + 1,
    };

    if (existed) {
        state.favorites = state.favorites.filter((f) => !(f.iconset === icon.iconset && f.path === icon.path));
        state.icons = state.icons.filter((i) => !(i.iconset === icon.iconset && i.path === icon.path));
    } else {
        state.favorites = [...state.favorites, entry];
        if (state.selectedPack === FAVORITES_PACK) {
            const already = state.icons.some((i) => i.iconset === icon.iconset && i.path === icon.path);
            if (!already) {
                const display = await displayFavorite(entry);
                if (
                    isFavorite(icon)
                    && !state.icons.some((i) => i.iconset === icon.iconset && i.path === icon.path)
                ) {
                    state.icons = [...state.icons, display];
                }
            }
        }
    }

    try {
        if (existed) {
            await removeFavorite(icon.iconset, icon.path);
        } else {
            await addFavorite(entry);
        }
    } catch (err) {
        state.favorites = prevFavs;
        state.icons = prevIcons;
        state.error = err instanceof Error ? err.message : String(err);
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
        try { api.map.off('mousemove', onMapMouseMove as never); } catch { /* ignore */ }
        window.removeEventListener('keydown', onKeyDown, true);
        removeAfterEach?.();
        removeAfterEach = undefined;
        stopMapStoreWatch?.();
        stopMapStoreWatch = undefined;
    }

    api = pluginAPI;
    ensureMapFocusStyle();

    try {
        api.map.on('click', onMapClick as never);
        api.map.on('mousemove', onMapMouseMove as never);
    } catch (err) {
        console.warn('QPD: map click handler not attached yet', err);
    }

    bindMapStoreWatch();

    window.addEventListener('keydown', onKeyDown, true);

    const unhook = api.router.afterEach((to) => {
        if (to.name !== ROUTE_NAME) {
            stopDrop();
            stopMove();
            stopChangeIcon();
            clearSaveTimer();
            state.editing = null;
            preEdit = null;
            state.organizing = false;
        }
    });
    if (typeof unhook === 'function') removeAfterEach = unhook;

    void load();
}

export function destroy(): void {
    clearSaveTimer();
    stopDrop();
    stopMove();
    stopChangeIcon();
    state.editing = null;
    preEdit = null;
    titleInputEl = null;
    removeAfterEach?.();
    removeAfterEach = undefined;
    stopMapStoreWatch?.();
    stopMapStoreWatch = undefined;
    try { api?.map.off('click', onMapClick as never); } catch { /* map not ready */ }
    try { api?.map.off('mousemove', onMapMouseMove as never); } catch { /* map not ready */ }
    window.removeEventListener('keydown', onKeyDown, true);
    applyDropCursor();
    revokeThumbs();
    revokeLibraryThumbs();
    state.organizing = false;
    api = null;
}
