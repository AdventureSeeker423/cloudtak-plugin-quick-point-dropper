# CloudTAK Plugin — Quick Point Dropper

Drop CoT points onto the CloudTAK map from any icon pack. Pick an icon, fill Title / Callsign and Notes / Remarks, and click the map repeatedly. A shared **Favorites** list is stored on the CloudTAK server; only system admins can star or unstar icons.

## Features

- Icon pack selector (`IconsetManager.list()`) plus CloudTAK’s four **Standard** points (unknown, friendly, hostile, neutral)
- Search box to filter icons by name
- Shared Favorites pack, persisted in CloudTAK Postgres (`qpd_favorites` + `qpd_sections`)
- Admin-curated **sections** and custom order (arrows or drag) via Organize
- Star overlays visible only to CloudTAK **system admins** (`AuthUserAccess.ADMIN` / `profile.system_admin`)
- Drop mode: crosshair cursor, every map click creates a new CoT even on top of an existing point
- Stacked points use CloudTAK’s built-in picker; the radial menu stays closed while this plugin is open
- Bottom-bar **Stop Dropping Points** widget while dropping
- With drop mode off and the panel open, click any CoT to load Title / Callsign, Notes / Remarks, and icon; changes save immediately
- **Move** relocates a selected point: click the map once to place it
- **Enumerate Points** appends a running number to each dropped callsign (starts at 1, 0 allowed)
- Empty Title / Callsign uses the icon’s name with each word capitalized; Notes / Remarks go to `properties.remarks` when filled

## Requirements

- CloudTAK **>= 13.45** (hub/api split: server routes load from `api/stateless/routes/`)

## Install

CloudTAK’s `WEB_PLUGINS` build arg **cannot** install this plugin: it only clones the web half, nests the plugin one level too deep for Vite, and drops `server/*.ts` where `vue-tsc` type-checks them (the `/api/qpd/*` routes never load). Use one of the paths below.

`install.sh` finds the CloudTAK checkout automatically. It uses the first of `$CLOUDTAK`, `~/CloudTAK`, `/home/takwerx/CloudTAK`, or `/home/*/CloudTAK` that has an `api/` dir. Running as root makes `~` expand to `/root`, so the `/home/takwerx` (and `/home/*`) fallbacks cover typical InfraTAK boxes. Pass a path only if yours is somewhere else: `./install.sh /opt/CloudTAK`.

### Install / update

```bash
git clone https://github.com/AdventureSeeker423/cloudtak-plugin-quick-point-dropper.git
cd cloudtak-plugin-quick-point-dropper
./install.sh
```

That `git pull`s this repo, then copies:

- `plugin/` → `<CloudTAK>/api/web/plugins/quick-point-dropper/`
- `server/plugin-qpd.ts` → `<CloudTAK>/api/stateless/routes/`

and rebuilds and recreates the CloudTAK API image (5–15 minutes). Run the same `./install.sh` command to update later.

To deploy whatever is already in this checkout without pulling:

```bash
./install.sh --no-pull
```

### Remove

```bash
cd cloudtak-plugin-quick-point-dropper
./install.sh --remove
```

Copy files without rebuilding:

```bash
cd cloudtak-plugin-quick-point-dropper
./install.sh --no-build
```

After a rebuild, in CloudTAK go to **Settings → Refresh App** to activate the new service worker. A normal hard-refresh does **not** work — the service worker intercepts requests. Or close all CloudTAK tabs and reopen. The plugin appears at the bottom of the right-side menu.

### Local development

Follow the [CloudTAK Develop guide](https://docs.cloudtak.io/develop/) so the API (`api/`) and web (`api/web`) servers are running, then from this repo:

```bash
cd plugin
npm install
cd ..
CT="${CLOUDTAK:-$HOME/CloudTAK}"
[ -d "$CT/api" ] || CT="/home/takwerx/CloudTAK"
mkdir -p "$CT/api/web/plugins" "$CT/api/stateless/routes"
ln -sfn "$(pwd)/plugin" "$CT/api/web/plugins/quick-point-dropper"
cp "$(pwd)/server/plugin-qpd.ts" "$CT/api/stateless/routes/plugin-qpd.ts"
```

Restart the CloudTAK API so it loads `plugin-qpd.ts`, and restart `npm run serve` in `$CT/api/web`.

`api/web/plugins/` is git-ignored in CloudTAK. Point `plugin/package.json`’s `@tak-ps/cloudtak` `file:` path at `$CT/api/web` if it does not already resolve.

## Usage

1. Open **Quick Point Dropper** from the right-side menu.
2. Choose **Favorites**, **Standard**, or an icon pack. Use search to filter icons, and the list/grid button beside it for icon names.
3. The Title / Callsign box previews the selected icon’s name as placeholder text. Type to override it, or tap another icon to replace that default. Use the X to clear a custom title. Turn on **Enumerate Points** to append a counter (space + number) on each drop; set the next number or reset it to 1. Notes / Remarks persist across drops.
4. Tap an icon — the cursor becomes a crosshair. Every map click drops a new point.
5. Tap **Stop Dropping Points** in the bottom bar to leave drop mode, or **Escape** to stop dropping and also clear Title / Callsign, Notes / Remarks, and the selected icon. **Clear Selection** (top right) does the same clear.
6. With drop mode off, click any point on the map to load it. Overlapping points open CloudTAK’s selection list; picking one loads it here and does not open the radial. Title / Callsign, Notes / Remarks, and icon changes save immediately. **Move** then a map click relocates that point. **Change Icon** then a menu icon updates it in place. **Delete** then **Confirm Deletion** removes it. Click empty map or press **Escape** to deselect. Click an icon to start dropping again.
7. System admins tap **Edit Favorites** to add or remove icons and to arrange sections. Everyday dropping never stars or unstars by accident.
8. In the editor, **Add icons** toggles membership from any pack; **Arrange** is for named sections, drag-reorder, and remove. Starred icons with no section sit under **Unsorted**.

Closing the plugin panel also exits drop mode.

## How admins are decided

Writes go through `Auth.as_user(config, req, { admin: true })` in [`api/common/auth.ts`](https://github.com/dfpc-coe/CloudTAK/blob/main/api/common/auth.ts). That requires JWT `access === admin`, which CloudTAK sets from `profile.system_admin`. Agency admins cannot change Favorites. Grant system admin in the CloudTAK admin UI or via the OIDC group `CloudTAKSystemAdmin`.

The `GET /api/qpd/favorites` response includes `writable` so the UI can hide stars without decoding the token.

## Persistence

| Data | Where |
| --- | --- |
| Favorite icons and sections | CloudTAK Postgres tables `qpd_favorites` and `qpd_sections` (created on API load; survives image rebuilds) |
| Last selected pack, detailed grid | Browser `localStorage` keys `cloudtak-qpd-lastIconset`, `cloudtak-qpd-detailedView` |

## Layout

```
plugin/                 CloudTAK web plugin (Vite glob: plugins/*/index.ts)
  index.ts
  lib/
server/plugin-qpd.ts    Copied to api/stateless/routes/
install.sh
```
