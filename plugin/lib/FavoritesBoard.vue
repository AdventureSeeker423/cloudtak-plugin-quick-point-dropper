<template>
    <div>
        <div
            v-if='state.organizing'
            class='qpd-org-help mb-2'
        >
            Drag icons to move them. Click a section name to rename it. Use Add icons to bring in more.
        </div>
        <div
            v-if='state.organizing'
            class='d-flex gap-2 mb-3'
        >
            <input
                v-model='newSectionName'
                class='form-control form-control-sm'
                type='text'
                placeholder='New section name'
                @keydown.enter.prevent='onAddSection'
            >
            <button
                class='btn btn-sm btn-primary flex-shrink-0'
                type='button'
                :disabled='!newSectionName.trim()'
                @click='onAddSection'
            >
                <IconPlus
                    :size='16'
                />
                Section
            </button>
        </div>

        <div
            v-if='!groups.length'
            class='text-secondary small py-3 text-center'
        >
            <template v-if='state.query.trim()'>
                No icons match that search.
            </template>
            <template v-else>
                No favorite icons yet.
                <span v-if='state.writable'>Use Edit Favorites to add icons.</span>
                <span v-else>A system admin can add icons to Favorites.</span>
            </template>
        </div>

        <section
            v-for='group in groups'
            :key='group.id ?? "unsorted"'
            class='qpd-section-card'
            :class='{ "qpd-section-over": dragOver === sectionKey(group) }'
            @dragover='onSectionDragOver(group, $event)'
            @drop.prevent='onSectionDrop(group)'
            @dragleave='onSectionDragLeave(group)'
        >
            <div
                v-if='group.name || (state.organizing && group.id)'
                class='qpd-section-head'
            >
                <template v-if='state.organizing && group.id'>
                    <button
                        class='btn btn-sm btn-ghost-secondary px-1'
                        type='button'
                        title='Move section up'
                        :disabled='!canMoveSection(group.id, -1)'
                        @click='moveSection(group.id, -1)'
                    >
                        <IconChevronUp
                            :size='16'
                        />
                    </button>
                    <button
                        class='btn btn-sm btn-ghost-secondary px-1'
                        type='button'
                        title='Move section down'
                        :disabled='!canMoveSection(group.id, 1)'
                        @click='moveSection(group.id, 1)'
                    >
                        <IconChevronDown
                            :size='16'
                        />
                    </button>
                    <input
                        v-if='renamingId === group.id'
                        v-model='renameValue'
                        class='form-control form-control-sm qpd-rename'
                        type='text'
                        @keydown.enter.prevent='commitRename'
                        @keydown.escape.prevent='renamingId = null'
                        @blur='commitRename'
                    >
                    <button
                        v-else
                        class='qpd-section-title-btn'
                        type='button'
                        title='Rename section'
                        @click='startRename(group)'
                    >
                        {{ group.name }}
                    </button>
                    <button
                        class='btn btn-sm btn-ghost-danger px-1 ms-auto'
                        type='button'
                        title='Delete section'
                        @click='onDeleteSection(group.id, group.name)'
                    >
                        <IconTrash
                            :size='14'
                        />
                    </button>
                </template>
                <span
                    v-else
                    class='qpd-section-title'
                >{{ group.name }}</span>
            </div>

            <div
                v-if='state.organizing && !group.icons.length'
                class='qpd-empty-drop'
            >
                Drag icons here
            </div>
            <div
                v-else
                :class='iconListClass'
            >
                <div
                    v-for='icon in group.icons'
                    :key='icon.key'
                    class='qpd-fav-item'
                    :class='{
                        "qpd-drop-before": dragOver === iconKey(icon),
                        "qpd-fav-item-org": state.organizing
                    }'
                    :draggable='state.organizing'
                    @dragstart='onRowDragStart(icon, $event)'
                    @dragend='onDragEnd'
                    @dragover='onIconDragOver(icon, $event)'
                    @drop.prevent.stop='onIconDrop(icon)'
                >
                    <span
                        v-if='state.organizing'
                        class='qpd-grip'
                        title='Drag to move'
                    >
                        <IconGripVertical
                            :size='16'
                        />
                    </span>
                    <button
                        type='button'
                        :class='[
                            (state.organizing || state.detailed) ? "qpd-list-item" : "qpd-icon",
                            {
                                "qpd-icon-selected": !state.organizing && state.selected?.key === icon.key,
                                "qpd-list-item-static": state.organizing
                            }
                        ]'
                        :title='iconLabel(icon)'
                        @click='onPick(icon)'
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
                            v-if='state.organizing || state.detailed'
                            class='qpd-list-label'
                        >{{ iconLabel(icon) }}</span>
                    </button>
                    <div
                        v-if='state.organizing'
                        class='qpd-fav-tools'
                    >
                        <select
                            class='form-select form-select-sm'
                            :value='icon.sectionId || ""'
                            title='Move to section'
                            @click.stop
                            @mousedown.stop
                            @change='onAssign(icon, $event)'
                        >
                            <option value=''>
                                Unsorted
                            </option>
                            <option
                                v-for='section in sections'
                                :key='section.id'
                                :value='section.id'
                            >
                                {{ section.name }}
                            </option>
                        </select>
                        <button
                            class='btn btn-sm btn-ghost-secondary px-1'
                            type='button'
                            title='Move up'
                            :disabled='!canMoveIcon(group, icon, -1)'
                            @click.stop='moveIcon(icon, -1)'
                        >
                            <IconChevronUp
                                :size='16'
                            />
                        </button>
                        <button
                            class='btn btn-sm btn-ghost-secondary px-1'
                            type='button'
                            title='Move down'
                            :disabled='!canMoveIcon(group, icon, 1)'
                            @click.stop='moveIcon(icon, 1)'
                        >
                            <IconChevronDown
                                :size='16'
                            />
                        </button>
                        <button
                            class='btn btn-sm btn-ghost-danger px-1'
                            type='button'
                            title='Remove from favorites'
                            @click.stop='toggleFavorite(icon)'
                        >
                            <IconStarFilled
                                :size='14'
                            />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import {
    IconStarFilled,
    IconPlus,
    IconTrash,
    IconChevronUp,
    IconChevronDown,
    IconGripVertical,
} from '@tabler/icons-vue';
import {
    state,
    selectIcon,
    toggleFavorite,
    favoriteGroups,
    sortedSections,
    createSection,
    renameSection,
    deleteSection,
    moveSection,
    moveIcon,
    assignIconSection,
    placeIcon,
    iconLabel,
    type DisplayIcon,
    type FavoriteGroup,
} from './dropper.ts';

const newSectionName = ref('');
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const dragOver = ref('');
let dragging: DisplayIcon | null = null;

const groups = computed(() => favoriteGroups());
const sections = computed(() => sortedSections());
const iconListClass = computed(() => (
    state.organizing || state.detailed ? 'qpd-list' : 'qpd-grid'
));

function iconKey(icon: DisplayIcon): string {
    return `icon:${icon.key}`;
}

function sectionKey(group: FavoriteGroup): string {
    return `section:${group.id ?? 'unsorted'}`;
}

function onPick(icon: DisplayIcon): void {
    if (state.organizing) return;
    selectIcon(icon);
}

function onAddSection(): void {
    const name = newSectionName.value.trim();
    if (!name) return;
    void createSection(name);
    newSectionName.value = '';
}

function startRename(group: FavoriteGroup): void {
    if (!group.id) return;
    renamingId.value = group.id;
    renameValue.value = group.name;
}

function commitRename(): void {
    const id = renamingId.value;
    if (!id) return;
    const name = renameValue.value.trim();
    renamingId.value = null;
    if (!name) return;
    void renameSection(id, name);
}

function onDeleteSection(id: string, name: string): void {
    if (!window.confirm(`Delete section “${name}”? Icons in it move to Unsorted.`)) return;
    void deleteSection(id);
}

function canMoveSection(id: string, dir: -1 | 1): boolean {
    const list = sections.value;
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    return i >= 0 && j >= 0 && j < list.length;
}

function canMoveIcon(group: FavoriteGroup, icon: DisplayIcon, dir: -1 | 1): boolean {
    const i = group.icons.findIndex((item) => item.key === icon.key);
    const j = i + dir;
    return i >= 0 && j >= 0 && j < group.icons.length;
}

function onAssign(icon: DisplayIcon, ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    void assignIconSection(icon, value || null);
}

function onRowDragStart(icon: DisplayIcon, ev: DragEvent): void {
    if (!state.organizing) return;
    const target = ev.target as HTMLElement | null;
    if (target?.closest('select, button.btn-ghost-danger, button.btn-ghost-secondary')) {
        ev.preventDefault();
        return;
    }
    dragging = icon;
    if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', icon.key);
    }
}

function onDragEnd(): void {
    dragging = null;
    dragOver.value = '';
}

function onIconDragOver(icon: DisplayIcon, ev: DragEvent): void {
    if (!state.organizing || !dragging || dragging.key === icon.key) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    dragOver.value = iconKey(icon);
}

function onIconDrop(icon: DisplayIcon): void {
    if (!dragging) return;
    const moving = dragging;
    dragging = null;
    dragOver.value = '';
    void placeIcon(moving, icon.sectionId || null, icon);
}

function onSectionDragOver(group: FavoriteGroup, ev: DragEvent): void {
    if (!state.organizing || !dragging) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    if (!dragOver.value.startsWith('icon:')) dragOver.value = sectionKey(group);
}

function onSectionDragLeave(group: FavoriteGroup): void {
    if (dragOver.value === sectionKey(group)) dragOver.value = '';
}

function onSectionDrop(group: FavoriteGroup): void {
    if (!dragging) return;
    const moving = dragging;
    dragging = null;
    dragOver.value = '';
    void placeIcon(moving, group.id, null);
}
</script>

<style scoped>
.qpd-org-help {
    font-size: 12px;
    line-height: 1.4;
    color: var(--tblr-secondary, #667382);
}
.qpd-section-card {
    margin-bottom: 10px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.18);
}
.qpd-section-over {
    outline: 2px dashed var(--tblr-primary, #206bc4);
    background: rgba(32, 107, 196, 0.12);
}
.qpd-section-head {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.qpd-section-title,
.qpd-section-title-btn {
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tblr-secondary, #adb5bd);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
}
.qpd-section-title-btn {
    flex: 1;
    border: 0;
    background: transparent;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: text;
}
.qpd-section-title-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
}
.qpd-rename {
    min-width: 0;
    flex: 1;
}
.qpd-empty-drop {
    color: #6c7a89;
    font-size: 12px;
    text-align: center;
    padding: 14px 8px;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    border-radius: 6px;
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
    min-height: 36px;
}
.qpd-fav-item {
    display: flex;
    align-items: stretch;
    gap: 4px;
    border-radius: 6px;
}
.qpd-fav-item-org {
    cursor: grab;
    padding: 2px;
}
.qpd-fav-item-org:active {
    cursor: grabbing;
}
.qpd-drop-before {
    box-shadow: inset 0 2px 0 var(--tblr-primary, #206bc4);
}
.qpd-grip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    padding: 0;
    color: #6c7a89;
    pointer-events: none;
}
.qpd-fav-tools {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    max-width: 52%;
}
.qpd-fav-tools .form-select {
    min-width: 0;
    font-size: 12px;
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
    min-width: 0;
    flex: 1;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
}
.qpd-list-item-static {
    cursor: grab;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
