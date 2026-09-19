<template>
    <button
        v-if='!state.organizing'
        class='btn btn-sm btn-outline-secondary'
        type='button'
        title='Clear title, notes, and selected icon'
        @click='clearSelection'
    >
        <IconX
            :size='16'
            class='me-1'
        />
        Clear Selection
    </button>
</template>

<script setup lang='ts'>
import { IconX } from '@tabler/icons-vue';
import {
    state,
    clearSelection,
} from './dropper.ts';
</script>
