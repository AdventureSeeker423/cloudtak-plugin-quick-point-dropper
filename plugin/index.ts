import type { App } from 'vue';
import { h, markRaw } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
import MenuTemplate from './lib/MenuTemplate.vue';
import DropperContainer from './lib/DropperContainer.vue';
import DropperBottomBar from './lib/DropperBottomBar.vue';
import IconPinUrl from './lib/Pin.svg';
import {
    ROUTE_NAME,
    MENU_KEY,
    BOTTOM_BAR_KEY,
    init,
    destroy,
    setDroppingListener,
} from './lib/dropper.ts';

const IconPin = {
    render: () => h('img', {
        src: IconPinUrl,
        width: 32,
        height: 32
    })
};

export default class QuickPointDropper implements PluginInstance {
    api: PluginAPI;

    constructor(api: PluginAPI) {
        this.api = api;

        // Routes register once at install time and are never removed —
        // CloudTAK calls disable() before enable() on load, so removing
        // the route at disable() makes the subsequent menu.add fail.
        this.api.routes.add({
            path: 'plugin-quick-point-dropper',
            name: ROUTE_NAME,
            component: {
                render: () => h(MenuTemplate, { name: 'Quick Point Dropper', back: false }, {
                    default: () => h(DropperContainer, { api: this.api })
                })
            }
        }, 'home-menu');
    }

    static async install(
        app: App,
        api: PluginAPI
    ): Promise<PluginInstance> {
        void app;
        return new QuickPointDropper(api);
    }

    async enable(): Promise<void> {
        setDroppingListener((dropping) => {
            if (dropping) {
                this.api.bottomBar.add({
                    key: BOTTOM_BAR_KEY,
                    component: markRaw(DropperBottomBar)
                });
            } else {
                this.api.bottomBar.remove(BOTTOM_BAR_KEY);
            }
        });

        init(this.api);

        this.api.menu.add({
            key: MENU_KEY,
            label: 'Quick Point Dropper',
            route: ROUTE_NAME,
            tooltip: 'Quick Point Dropper',
            description: 'Drop CoT points from icon packs',
            icon: IconPin
        });
    }

    async disable(): Promise<void> {
        destroy();
        setDroppingListener(null);
        try { this.api.bottomBar.remove(BOTTOM_BAR_KEY); } catch { /* ignore */ }
        try { this.api.menu.remove(MENU_KEY); } catch { /* ignore */ }
        // Intentionally NOT removing the route — see constructor note.
    }
}
