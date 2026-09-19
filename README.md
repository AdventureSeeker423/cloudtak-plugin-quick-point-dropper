# CloudTAK Plugin — Quick Point Dropper

Drop CoT points onto the CloudTAK map from any icon pack. Pick an icon, fill Title/Remarks, and click the map repeatedly. A shared **Favorites** list is stored on the CloudTAK server; only system admins can star or unstar icons.

## Features

- Icon pack selector (`IconsetManager.list()`) plus CloudTAK’s four **Standard** points (unknown, friendly, hostile, neutral)
- Search box to filter icons by name
- Shared Favorites pack, persisted in CloudTAK Postgres (`qpd_favorites` + `qpd_sections`)
- Admin-curated **sections** and custom order (arrows or drag) via Organize
- Star overlays visible only to CloudTAK **system admins** (`AuthUserAccess.ADMIN` / `profile.system_admin`)
- Drop mode: crosshair cursor, every map click creates a new CoT (`u-d-p`) even on top of an existing point
- Sticky in-panel Stop bar plus a bottom-bar Stop widget while dropping
- With drop mode off and the panel open, click any CoT to load Title/Remarks/icon; changes save immediately
- Empty Title uses the icon’s name; Remarks go to `properties.remarks` when filled

## Requirements

- CloudTAK **>= 13.45** (hub/api split: server routes load from `api/stateless/routes/`)

## Install

CloudTAK’s `WEB_PLUGINS` build arg **cannot** install this plugin: it only clones the web half, nests the plugin one level too deep for Vite, and drops `server/*.ts` where `vue-tsc` type-checks them (the `/api/qpd/*` routes never load). Use one of the paths below.

These commands assume CloudTAK lives at `~/CloudTAK` (the `install.sh` default). If yours is elsewhere, change that path.

### Install / update

```bash
git clone https://github.com/AdventureSeeker423/cloudtak-plugin-quick-point-dropper.git
cd cloudtak-plugin-quick-point-dropper
./install.sh ~/CloudTAK
```

That `git pull`s this repo, then copies:

- `plugin/` → `~/CloudTAK/api/web/plugins/quick-point-dropper/`
- `server/plugin-qpd.ts` → `~/CloudTAK/api/stateless/routes/`

and rebuilds and recreates the CloudTAK API image (5–15 minutes). Run the same `./install.sh ~/CloudTAK` command to update later.

To deploy whatever is already in this checkout without pulling:

```bash
./install.sh --no-pull ~/CloudTAK
```

### Remove

```bash
cd cloudtak-plugin-quick-point-dropper
./install.sh --remove ~/CloudTAK
```

Copy files without rebuilding:

```bash
cd cloudtak-plugin-quick-point-dropper
./install.sh --no-build ~/CloudTAK
```

After a rebuild, in CloudTAK go to **Settings → Refresh App** to activate the new service worker. A normal hard-refresh does **not** work — the service worker intercepts requests. Or close all CloudTAK tabs and reopen. The plugin appears at the bottom of the right-side menu.

### Local development

Follow the [CloudTAK Develop guide](https://docs.cloudtak.io/develop/) so the API (`api/`) and web (`api/web`) servers are running, then from this repo:

```bash
cd plugin
npm install
cd ..
mkdir -p ~/CloudTAK/api/web/plugins ~/CloudTAK/api/stateless/routes
ln -sfn "$(pwd)/plugin" ~/CloudTAK/api/web/plugins/quick-point-dropper
cp "$(pwd)/server/plugin-qpd.ts" ~/CloudTAK/api/stateless/routes/plugin-qpd.ts
```

Restart the CloudTAK API so it loads `plugin-qpd.ts`, and restart `npm run serve` in `~/CloudTAK/api/web`.

`api/web/plugins/` is git-ignored in CloudTAK. Point `plugin/package.json`’s `@tak-ps/cloudtak` `file:` path at `~/CloudTAK/api/web` if it does not already resolve.

## Usage

1. Open **Quick Point Dropper** from the right-side menu.
2. Choose **Favorites**, **Standard**, or an icon pack. Toggle the grid button for icon names. Use the search box to filter icons.
3. Optionally set Title and Remarks (they persist across drops).
4. Tap an icon — the cursor becomes a crosshair. Every map click drops a new point.
5. Tap **Stop** (panel banner or bottom bar) or **Escape** to leave drop mode.
6. With drop mode off, click any point on the map to load it. Title, Remarks, and icon changes save immediately. A **Delete** button appears at the top to remove that point. Click empty map or press **Escape** to deselect it and go back to dropping.
7. System admins can star/unstar icons. Everyone else sees the same Favorites list without star controls.
8. System admins can tap **Organize** on Favorites to create named sections, rename or delete them, and reorder sections and icons (up/down or drag). Starred icons with no section sit under **Unsorted**.

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
