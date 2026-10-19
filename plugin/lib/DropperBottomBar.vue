<template>
    <div
        class='d-flex align-items-center justify-content-center px-2 cursor-pointer cloudtak-hover'
        :title='state.moving ? "Cancel move" : "Stop dropping points"'
        @click='onClick'
    >
        <IconPin
            :size='28'
            style='opacity: 0.95;'
        />
        <span class='small ps-1 text-nowrap'>
            {{ state.moving ? 'Cancel' : 'Stop Dropping Points' }}
        </span>
    </div>
</template>

<script setup lang='ts'>
import { IconPin } from './icon.ts';
import {
    state,
    stopDrop,
    stopMove,
} from './dropper.ts';

function onClick(): void {
    if (state.moving) stopMove();
    else stopDrop();
}
</script>
