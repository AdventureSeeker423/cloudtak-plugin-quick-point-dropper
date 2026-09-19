<template>
    <div>
        <button
            class='btn btn-primary w-100 mb-3'
            type='button'
            @click='setOrganizing(false)'
        >
            Done
        </button>

        <div
            class='btn-group w-100 mb-3'
            role='group'
            aria-label='Favorites editor'
        >
            <button
                type='button'
                class='btn btn-sm'
                :class='state.editTab === "add" ? "btn-primary" : "btn-outline-secondary"'
                @click='setEditTab("add")'
            >
                Add icons
            </button>
            <button
                type='button'
                class='btn btn-sm'
                :class='state.editTab === "arrange" ? "btn-primary" : "btn-outline-secondary"'
                @click='setEditTab("arrange")'
            >
                Arrange
            </button>
        </div>

        <template v-if='state.editTab === "add"'>
            <p class='small text-secondary mb-2'>
                Tap an icon to add or remove it from Favorites. This does not drop a point.
            </p>
            <div class='d-flex align-items-center gap-2 mb-2 flex-wrap'>
                <select
                    class='form-select form-select-sm'
                    :value='state.libraryPack'
                    @change='onLibraryPackChange'
                >
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
                <select
                    v-if='libraryFolderVisible'
                    class='form-select form-select-sm'
                    :value='state.libraryFolder'
                    @change='onLibraryFolderChange'
                >
                    <option
                        v-if='libraryFolders.length > 1 || libraryUngrouped'
                        :value='ALL_FOLDERS'
                    >
                        All
                    </option>
                    <option
                        v-for='folder in libraryFolders'
                        :key='folder'
                        :value='folder'
                    >
                        {{ folder }}
                    </option>
                    <option
                        v-if='libraryUngrouped'
                        :value='UNGROUPED_FOLDER'
                    >
                        Ungrouped
                    </option>
                </select>
            </div>
            <input
                v-model='state.libraryQuery'
                class='form-control form-control-sm mb-2'
                type='search'
                placeholder='Search icons to add'
                aria-label='Search icons to add'
            >
            <div
                v-if='state.libraryLoading || state.loading'
                class='text-secondary small py-3 text-center'
            >
                Loading icons…
            </div>
            <div
                v-else-if='!libraryIcons.length'
                class='text-secondary small py-3 text-center'
            >
                No icons match.
            </div>
            <div
                v-else
                class='qpd-add-list'
            >
                <button
                    v-for='icon in libraryIcons'
                    :key='icon.key'
                    class='qpd-add-row'
                    :class='{ "qpd-add-on": isFavorite(icon) }'
                    type='button'
                    :title='iconLabel(icon)'
                    @click='toggleFavorite(icon)'
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
                    <span class='qpd-list-label'>{{ iconLabel(icon) }}</span>
                    <span class='qpd-add-badge'>
                        {{ isFavorite(icon) ? 'Added' : 'Add' }}
                    </span>
                </button>
            </div>
        </template>

        <template v-else>
            <FavoritesBoard />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import FavoritesBoard from './FavoritesBoard.vue';
import {
    state,
    STANDARD_PACK,
    ALL_FOLDERS,
    UNGROUPED_FOLDER,
    setOrganizing,
    setEditTab,
    loadLibrary,
    selectLibraryFolder,
    showLibraryFolderSelect,
    visibleLibraryIcons,
    packFolders,
    hasUngroupedIcons,
    isFavorite,
    toggleFavorite,
    iconLabel,
} from './dropper.ts';

const libraryIcons = computed(() => visibleLibraryIcons());
const libraryFolders = computed(() => packFolders(state.libraryIcons));
const libraryFolderVisible = computed(() => showLibraryFolderSelect());
const libraryUngrouped = computed(() => hasUngroupedIcons(state.libraryIcons));

function onLibraryPackChange(ev: Event): void {
    void loadLibrary((ev.target as HTMLSelectElement).value);
}

function onLibraryFolderChange(ev: Event): void {
    selectLibraryFolder((ev.target as HTMLSelectElement).value);
}
</script>

<style scoped>
.qpd-add-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.qpd-add-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    cursor: pointer;
}
.qpd-add-row:hover {
    background: rgba(255, 255, 255, 0.08);
}
.qpd-add-on {
    border-color: var(--tblr-primary, #206bc4);
    background: rgba(32, 107, 196, 0.16);
}
.qpd-add-badge {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--tblr-secondary, #adb5bd);
}
.qpd-add-on .qpd-add-badge {
    color: var(--tblr-primary, #74b0ff);
}
.qpd-icon-thumb {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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
.qpd-list-label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.3;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
