<template>
    <div class='col-12 px-2 pt-2 pb-3'>
        <div
            v-if='state.editing && !state.organizing'
            class='d-flex mb-2 gap-2'
        >
            <button
                class='btn btn-sm w-100'
                :class='state.moving ? "btn-primary" : "btn-outline-secondary"'
                type='button'
                @click='onMoveClick'
            >
                <IconArrowsMove
                    :size='16'
                    class='me-1'
                />
                Move
            </button>
            <button
                class='btn btn-sm w-100'
                :class='state.changingIcon ? "btn-primary" : "btn-outline-secondary"'
                type='button'
                @click='onChangeIconClick'
            >
                <IconReplace
                    :size='16'
                    class='me-1'
                />
                Change Icon
            </button>
            <button
                class='btn btn-sm w-100'
                :class='confirmDelete ? "btn-danger" : "btn-outline-danger"'
                type='button'
                @click='onDeleteClick'
            >
                <IconTrash
                    :size='16'
                    class='me-1'
                />
                {{ confirmDelete ? 'Confirm Deletion' : 'Delete' }}
            </button>
        </div>

        <div
            v-if='state.moving && state.editing && !state.organizing'
            class='alert alert-info d-flex align-items-center justify-content-between py-2 px-3 mb-2 sticky-top'
            role='status'
        >
            <span class='small'>
                Click the map to move this point
            </span>
            <button
                class='btn btn-sm btn-dark'
                type='button'
                @click='stopMove'
            >
                Cancel
            </button>
        </div>

        <div
            v-if='state.changingIcon && state.editing && !state.organizing'
            class='alert alert-info d-flex align-items-center justify-content-between py-2 px-3 mb-2 sticky-top'
            role='status'
        >
            <span class='small'>
                Tap an icon to change this point
            </span>
            <button
                class='btn btn-sm btn-dark'
                type='button'
                @click='stopChangeIcon'
            >
                Cancel
            </button>
        </div>

        <div
            v-if='state.error'
            class='alert alert-danger py-2 px-3 mb-2 small'
            role='alert'
        >
            {{ state.error }}
            <button
                type='button'
                class='btn-close float-end'
                aria-label='Dismiss'
                @click='state.error = ""'
            />
        </div>

        <FavoritesEditor v-if='state.organizing' />

        <div
            v-show='!state.organizing'
            class='d-flex align-items-center gap-2 mb-2'
        >
            <select
                class='form-select form-select-sm'
                :value='state.selectedPack'
                @change='onPackChange'
            >
                <option :value='FAVORITES_PACK'>
                    Favorites
                </option>
                <option :value='STANDARD_PACK'>
                    Standard
                </option>
                <option
                    v-for='pack in state.packs'
                    :key='pack.uid'
                    :value='pack.uid'
                >
                    {{ pack.name }}
                </option>
            </select>
            <button
                v-if='state.writable'
                type='button'
                class='btn btn-sm btn-outline-secondary flex-shrink-0'
                title='Edit favorites'
                @click='setOrganizing(true)'
            >
                <IconAdjustments
                    :size='18'
                />
                <span class='ms-1'>Edit Favorites</span>
            </button>
        </div>
        <div
            v-if='!state.organizing && folderSelectVisible'
            class='mb-2'
        >
            <select
                class='form-select form-select-sm'
                :value='state.selectedFolder'
                @change='onFolderChange'
            >
                <option
                    v-if='folders.length > 1 || ungrouped'
                    :value='ALL_FOLDERS'
                >
                    All
                </option>
                <option
                    v-for='folder in folders'
                    :key='folder'
                    :value='folder'
                >
                    {{ folder }}
                </option>
                <option
                    v-if='ungrouped'
                    :value='UNGROUPED_FOLDER'
                >
                    Ungrouped
                </option>
            </select>
        </div>

        <div
            v-show='!state.organizing'
            class='mb-2'
        >
            <label class='form-label small mb-1'>Title / Callsign</label>
            <div class='input-group input-group-sm'>
                <input
                    ref='titleInput'
                    v-model='state.title'
                    class='form-control'
                    type='text'
                    :placeholder='titlePreview'
                >
                <button
                    type='button'
                    class='btn btn-outline-secondary'
                    :disabled='!state.title'
                    title='Clear title'
                    aria-label='Clear title'
                    @click='state.title = ""'
                >
                    <IconX
                        :size='16'
                    />
                </button>
            </div>
        </div>
        <div
            v-show='!state.organizing'
            class='qpd-enum-row mb-2'
        >
            <label
                class='small text-nowrap mb-0'
                for='qpd-enumerate'
            >Enumerate Points</label>
            <div class='form-check form-switch mb-0'>
                <input
                    id='qpd-enumerate'
                    class='form-check-input qpd-enum-switch'
                    type='checkbox'
                    :checked='state.enumerate'
                    @change='onEnumerateToggle'
                >
            </div>
            <div
                v-if='state.enumerate'
                class='qpd-enum-tools'
            >
                <input
                    class='form-control form-control-sm qpd-enum-num'
                    type='number'
                    min='0'
                    step='1'
                    :value='state.enumerateNext'
                    title='Next number'
                    aria-label='Next number'
                    @input='onEnumerateInput'
                    @blur='onEnumerateBlur'
                >
                <button
                    class='btn btn-sm btn-outline-secondary px-2'
                    type='button'
                    title='Reset to 1'
                    aria-label='Reset to 1'
                    @click='resetEnumerate'
                >
                    <IconRotate
                        :size='16'
                    />
                </button>
            </div>
        </div>
        <div
            v-show='!state.organizing'
            class='mb-2'
        >
            <label class='form-label small mb-1'>Notes / Remarks</label>
            <textarea
                v-model='state.remarks'
                class='form-control form-control-sm'
                rows='2'
            />
        </div>
        <div
            v-show='!state.organizing'
            class='mb-3'
        >
            <label class='form-label small mb-1'>Coordinates</label>
            <div
                class='input-group input-group-sm'
                :title='coordHint'
            >
                <button
                    class='btn btn-outline-secondary'
                    type='button'
                    :disabled='!coordEditable'
                    :title='coordEditable ? "Paste" : coordHint'
                    aria-label='Paste coordinates'
                    @click='onCoordPasteClick'
                >
                    <IconClipboard
                        :size='16'
                    />
                </button>
                <input
                    v-model='coordText'
                    class='form-control'
                    type='text'
                    :readonly='!coordEditable'
                    placeholder='DD, DM, DMS, MGRS, or UTM'
                    :title='coordHint'
                    aria-label='Coordinates'
                    @input='coordUserEdit = true'
                    @paste='onCoordPaste'
                    @keydown.enter.prevent='onCoordEnter'
                >
                <button
                    v-if='coordEditable && state.dropping'
                    type='button'
                    class='btn btn-outline-secondary'
                    :disabled='!coordText'
                    title='Clear coordinates'
                    aria-label='Clear coordinates'
                    @click='coordText = ""'
                >
                    <IconX
                        :size='16'
                    />
                </button>
            </div>
        </div>

        <div
            v-show='!state.organizing'
            class='d-flex align-items-center gap-2 mb-2'
        >
            <div class='input-group input-group-sm'>
                <input
                    v-model='state.query'
                    class='form-control'
                    type='search'
                    placeholder='Search icons'
                    aria-label='Search icons'
                >
                <button
                    type='button'
                    class='btn btn-outline-secondary'
                    :disabled='!state.query'
                    title='Clear search'
                    aria-label='Clear search'
                    @click='state.query = ""'
                >
                    <IconX
                        :size='16'
                    />
                </button>
            </div>
            <button
                type='button'
                class='btn btn-sm btn-outline-secondary flex-shrink-0'
                :title='state.detailed ? "Compact grid" : "Show full names in a list"'
                @click='setDetailed(!state.detailed)'
            >
                <IconListDetails
                    v-if='!state.detailed'
                    :size='18'
                />
                <IconLayoutGrid
                    v-else
                    :size='18'
                />
            </button>
        </div>

        <div
            v-if='!state.organizing && state.loading'
            class='text-secondary small py-3 text-center'
        >
            Loading icons…
        </div>
        <FavoritesBoard
            v-else-if='!state.organizing && state.selectedPack === FAVORITES_PACK'
        />
        <div
            v-else-if='!state.organizing && !icons.length && state.query.trim()'
            class='text-secondary small py-3 text-center'
        >
            No icons match that search.
        </div>
        <div
            v-else-if='!state.organizing && !icons.length'
            class='text-secondary small py-3 text-center'
        >
            This pack has no icons.
        </div>
        <div
            v-else-if='!state.organizing'
            :class='state.detailed ? "qpd-list" : "qpd-grid"'
        >
            <button
                v-for='icon in icons'
                :key='icon.key'
                type='button'
                :class='[
                    state.detailed ? "qpd-list-item" : "qpd-icon",
                    { "qpd-icon-selected": state.selected?.key === icon.key }
                ]'
                :title='iconLabel(icon)'
                @click='selectIcon(icon)'
            >
                <span class='qpd-icon-thumb'>
                    <img
                        v-if='icon.url'
                        :src='icon.url'
                        :alt='iconLabel(icon)'
                    >
                    <span
                        v-else
                        class='qpd-icon-missing'
                    >?</span>
                </span>
                <span
                    v-if='state.detailed'
                    class='qpd-list-label'
                >{{ iconLabel(icon) }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
    IconLayoutGrid,
    IconListDetails,
    IconTrash,
    IconAdjustments,
    IconArrowsMove,
    IconReplace,
    IconX,
    IconRotate,
    IconClipboard,
} from '@tabler/icons-vue';
import FavoritesBoard from './FavoritesBoard.vue';
import FavoritesEditor from './FavoritesEditor.vue';
import {
    state,
    FAVORITES_PACK,
    STANDARD_PACK,
    ALL_FOLDERS,
    UNGROUPED_FOLDER,
    selectPack,
    selectFolder,
    selectIcon,
    stopMove,
    stopChangeIcon,
    toggleMove,
    toggleChangeIcon,
    deletePoint,
    setDetailed,
    setOrganizing,
    packFolders,
    showFolderSelect,
    hasUngroupedIcons,
    visibleIcons,
    defaultCallsign,
    iconLabel,
    bindTitleInput,
    setEnumerate,
    setEnumerateNext,
    resetEnumerate,
    enumeratedCallsign,
    applyCoords,
    formatCoords,
} from './dropper.ts';

defineProps<{
    api?: unknown;
}>();

const folders = computed(() => packFolders(state.icons));
const folderSelectVisible = computed(() => showFolderSelect(state.icons));
const ungrouped = computed(() => hasUngroupedIcons(state.icons));
const icons = computed(() => visibleIcons());
const titlePreview = computed(() => {
    const stem = defaultCallsign(state.selected) || 'Point';
    if (!state.enumerate) return stem;
    return enumeratedCallsign(stem);
});
const confirmDelete = ref(false);
const titleInput = ref<HTMLInputElement | null>(null);
const coordText = ref('');
const coordUserEdit = ref(false);

const coordEditable = computed(() => (
    !state.organizing && (state.dropping || (state.moving && !!state.editing))
));

const coordHint = computed(() => {
    if (coordEditable.value) return 'DD, DM, DMS, MGRS, or UTM';
    if (state.editing) return 'Click Move to edit these coordinates';
    return 'Select an icon first to enter coordinates';
});

async function submitCoords(raw: string): Promise<void> {
    if (!coordEditable.value) return;
    const result = await applyCoords(raw);
    coordText.value = result.text;
    if (result.ok) coordUserEdit.value = false;
}

async function pasteCoords(text: string): Promise<void> {
    const value = text.trim();
    if (!value) return;
    coordUserEdit.value = true;
    coordText.value = value;
    await submitCoords(value);
}

function onCoordPaste(ev: ClipboardEvent): void {
    if (!coordEditable.value) {
        ev.preventDefault();
        return;
    }
    ev.preventDefault();
    void pasteCoords(ev.clipboardData?.getData('text') ?? '');
}

async function onCoordPasteClick(): Promise<void> {
    if (!coordEditable.value) return;
    try {
        await pasteCoords(await navigator.clipboard.readText());
    } catch {
        state.error = 'Could not read the clipboard';
    }
}

function onCoordEnter(): void {
    if (!coordEditable.value) return;
    void submitCoords(coordText.value);
}

watch(titleInput, (el) => {
    bindTitleInput(el);
}, { immediate: true });

onBeforeUnmount(() => {
    bindTitleInput(null);
});

watch(() => state.editing?.id, () => {
    confirmDelete.value = false;
});

watch(() => state.dropping, (dropping) => {
    if (!dropping) return;
    coordUserEdit.value = false;
    coordText.value = '';
});

watch(() => state.moving, (moving) => {
    if (!moving || !state.editing) return;
    coordUserEdit.value = false;
    coordText.value = formatCoords(state.editing.lat, state.editing.lng);
});

watch(
    () => [
        state.editing?.id,
        state.editing?.lat,
        state.editing?.lng,
        state.coordFormat,
        state.dropping,
        state.moving,
    ] as const,
    () => {
        if (state.dropping) return;
        if (coordUserEdit.value && coordEditable.value) return;
        coordText.value = state.editing
            ? formatCoords(state.editing.lat, state.editing.lng)
            : '';
    },
    { immediate: true },
);

function onMoveClick(): void {
    confirmDelete.value = false;
    toggleMove();
}

function onChangeIconClick(): void {
    confirmDelete.value = false;
    toggleChangeIcon();
}

function onDeleteClick(): void {
    if (!confirmDelete.value) {
        confirmDelete.value = true;
        return;
    }
    confirmDelete.value = false;
    void deletePoint();
}

function onEnumerateToggle(ev: Event): void {
    setEnumerate((ev.target as HTMLInputElement).checked);
}

function onEnumerateInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    if (el.value.trim() === '') return;
    const n = Number(el.value);
    if (!Number.isFinite(n) || n < 0) {
        setEnumerateNext(0);
        el.value = '0';
        return;
    }
    setEnumerateNext(n);
}

function onEnumerateBlur(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    if (el.value.trim() === '') {
        setEnumerateNext(0);
        el.value = '0';
    } else {
        el.value = String(state.enumerateNext);
    }
}

function onPackChange(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    void selectPack(value);
}

function onFolderChange(ev: Event): void {
    selectFolder((ev.target as HTMLSelectElement).value);
}
</script>

<style scoped>
.qpd-enum-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.qpd-enum-tools {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 12px;
}
.qpd-enum-switch:checked {
    background-color: var(--tblr-green, #2fb344);
    border-color: var(--tblr-green, #2fb344);
}
.qpd-enum-num {
    width: 3.25rem;
    flex: 0 0 3.25rem;
    padding-left: 4px;
    padding-right: 4px;
    text-align: center;
    -moz-appearance: textfield;
}
.qpd-enum-num::-webkit-outer-spin-button,
.qpd-enum-num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.qpd-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px;
}
.qpd-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.qpd-icon {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
}
.qpd-list-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
}
.qpd-icon:hover,
.qpd-list-item:hover {
    background: rgba(255, 255, 255, 0.06);
}
.qpd-icon.qpd-icon-selected,
.qpd-list-item.qpd-icon-selected {
    border-color: var(--tblr-primary, #206bc4);
    background: rgba(32, 107, 196, 0.18);
}
.qpd-icon-thumb {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.qpd-icon-thumb img {
    max-width: 40px;
    max-height: 40px;
    object-fit: contain;
}
.qpd-icon-missing {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    font-size: 14px;
    color: #adb5bd;
}
.qpd-star {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.65);
    color: #adb5bd;
}
.qpd-star:hover,
.qpd-star-on {
    color: #ffd43b;
}
.qpd-list-label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.3;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
}
</style>
