/*
 * Quick Point Dropper menu icon: a map pin with a plus in the lower right.
 *
 * Inline SVG (not an <img>) so fill/stroke="currentColor" follows the host
 * menu text colour in Light and Dark. CloudTAK's MenuItemCard renders icons
 * as components, so size → width/height, color → CSS color, and stroke is
 * accepted and ignored (an undeclared prop would fall through onto <svg>).
 */
import { defineComponent, h } from 'vue';

const VIEW_BOX = '0 0 24 24';

/** Pin body with a circular hole (evenodd), shifted left for the plus. */
const PIN_PATH = [
    'M11 18.5s-5.5-5.6-5.5-9.5a5.5 5.5 0 1 1 11 0c0 3.9-5.5 9.5-5.5 9.5z',
    'M11 9m-1.85 0a1.85 1.85 0 1 0 3.7 0a1.85 1.85 0 1 0-3.7 0',
].join('');

export const IconPin = defineComponent({
    name: 'IconPin',
    props: {
        size: { type: [Number, String], default: 32 },
        color: { type: String, default: 'currentColor' },
        stroke: { type: [Number, String], default: undefined },
    },
    setup(props) {
        return () => h('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: VIEW_BOX,
            width: props.size,
            height: props.size,
            fill: 'currentColor',
            'aria-hidden': 'true',
            focusable: 'false',
            style: { color: props.color },
        }, [
            h('path', { 'fill-rule': 'evenodd', d: PIN_PATH }),
            h('path', {
                d: 'M17.5 14.75v5.5M14.75 17.5h5.5',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': 1.75,
                'stroke-linecap': 'round',
            }),
        ]);
    },
});
