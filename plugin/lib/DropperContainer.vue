<template>
    <div class='col-12 px-2 pb-3'>
        <div
            v-if='state.dropping && state.selected'
            class='alert alert-info d-flex align-items-center justify-content-between py-2 px-3 mb-2 sticky-top'
            role='status'
        >
            <span class='small'>
                Dropping <strong>{{ state.selected.name }}</strong> — click the map to place points
            </span>
            <button
                class='btn btn-sm btn-dark'
                type='button'
                @click='stopDrop'
            >
                Stop
            </button>
        </div>

        <div
            v-if='state.editing'
            class='alert alert-warning d-flex align-items-center justify-content-between py-2 px-3 mb-2'
            role='status'
        >
            <span class='small'>Editing existing point</span>
            <span class='btn-list'>
                <button
                    class='btn btn-sm btn-primary'
                    type='button'
                    @click='updatePoint'
                >
                    Update Point
                </button>
                <button
                    class='btn btn-sm btn-outline-secondary'
                    type='button'
                    @click='cancelEdit'
                >
                    Cancel
                </button>
            </span>
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

        <div class='d-flex align-items-center gap-2 mb-2'>
            <select
                class='form-select form-select-sm'
                :value='state.selectedPack'
                @change='onPackChange'
            >
                <option :value='FAVORITES_PACK'>
                    Favorites
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
                type='button'
                class='btn btn-sm btn-outline-secondary flex-shrink-0'
                :title='state.detailed ? "Compact grid" : "Show icon names"'
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

        <div class='mb-2'>
            <label class='form-label small mb-1'>Title</label>
            <input
                v-model='state.title'
                class='form-control form-control-sm'
                type='text'
                placeholder='Icon name if empty'
            >
        </div>
        <div class='mb-3'>
            <label class='form-label small mb-1'>Remarks</label>
            <textarea
                v-model='state.remarks'
                class='form-control form-control-sm'
                rows='2'
                placeholder='Optional remarks'
            />
        </div>

        <div
            v-if='state.loading'
            class='text-secondary small py-3 text-center'
        >
            Loading icons…
        </div>
        <div
            v-else-if='!state.icons.length'
            class='text-secondary small py-3 text-center'
        >
            <template v-if='state.selectedPack === FAVORITES_PACK'>
                No favorite icons yet.
                <span v-if='state.writable'>Star icons from any pack to add them here.</span>
                <span v-else>A system admin can star icons from any pack.</span>
            </template>
            <template v-else>
                This pack has no icons.
            </template>
        </div>
        <div
            v-else
            class='qpd-grid'
            :class='{ "qpd-grid-detailed": state.detailed }'
        >
            <button
                v-for='icon in state.icons'
                :key='icon.key'
                type='button'
                class='qpd-icon'
                :class='{ "qpd-icon-selected": state.selected?.key === icon.key }'
                :title='icon.name'
                @click='selectIcon(icon)'
            >
                <span class='qpd-icon-thumb'>
                    <img
                        v-if='icon.url'
                        :src='icon.url'
                        :alt='icon.name'
                    >
                    <span
                        v-else
                        class='qpd-icon-missing'
                    >?</span>
                    <span
                        v-if='state.writable'
                        class='qpd-star'
                        :class='{ "qpd-star-on": isFavorite(icon) }'
                        title='Toggle favorite'
                        @click.stop='toggleFavorite(icon)'
                    >
                        <IconStarFilled
                            v-if='isFavorite(icon)'
                            :size='14'
                        />
                        <IconStar
                            v-else
                            :size='14'
                        />
                    </span>
                </span>
                <span
                    v-if='state.detailed'
                    class='qpd-icon-label'
                >{{ icon.name }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import {
    IconStar,
    IconStarFilled,
    IconLayoutGrid,
    IconListDetails,
} from '@tabler/icons-vue';
import {
    state,
    FAVORITES_PACK,
    selectPack,
    selectIcon,
    stopDrop,
    updatePoint,
    cancelEdit,
    setDetailed,
    isFavorite,
    toggleFavorite,
} from './dropper.ts';

defineProps<{
    api?: unknown;
}>();

function onPackChange(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    void selectPack(value);
}
</script>

<style scoped>
.qpd-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px;
}
.qpd-grid-detailed {
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
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
.qpd-icon:hover {
    background: rgba(255, 255, 255, 0.06);
}
.qpd-icon-selected {
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
.qpd-icon-label {
    font-size: 11px;
    line-height: 1.2;
    text-align: center;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
