<template>
    <div
        class='d-flex align-items-center justify-content-center px-2 cursor-pointer cloudtak-hover'
        title='Stop dropping points'
        @click='stopDrop'
    >
        <img
            :src='PinUrl'
            width='28'
            height='28'
            style='opacity: 0.95;'
        />
        <span class='small text-white ps-1 text-nowrap'>
            Stop
        </span>
    </div>
</template>

<script setup lang='ts'>
import PinUrl from './Pin.svg';
import { stopDrop } from './dropper.ts';
</script>
