# CloudTAK Plugin — Quick Point Dropper

Drop CoT points onto the CloudTAK map from any icon pack. Pick an icon, fill Title/Remarks, and click the map repeatedly. A shared **Favorites** list is stored on the CloudTAK server; only system admins can star or unstar icons.

## Features

- Icon pack selector (`IconsetManager.list()`) with a compact/detailed grid
- Shared Favorites pack, persisted in CloudTAK Postgres (`qpd_favorites`)
- Star overlays visible only to CloudTAK **system admins** (`AuthUserAccess.ADMIN` / `profile.system_admin`)
- Drop mode: crosshair cursor, every map click creates a new CoT (`u-d-p`) even on top of an existing point
- Sticky in-panel Stop bar plus a bottom-bar Stop widget while dropping
- With drop mode off and the panel open, click any CoT to load Title/Remarks/icon and **Update Point**
- Empty Title uses the icon’s name; Remarks go to `properties.remarks` when filled

## Requirements

- CloudTAK **>= 13.45** (hub/api split: server routes load from `api/stateless/routes/`)

## Install

CloudTAK’s `WEB_PLUGINS` build arg **cannot** install this plugin: it only clones the web half, nests the plugin one level too deep for Vite, and drops `server/*.ts` where `vue-tsc` type-checks them (the `/api/qpd/*` routes never load). Use one of the paths below.

### Production (`install.sh`)

```bash
git clone <this-repo> cloudtak-plugin-quick-point-dropper
cd cloudtak-plugin-quick-point-dropper
./install.sh /path/to/CloudTAK
```

That copies:

- `plugin/` → `CloudTAK/api/web/plugins/quick-point-dropper/`
- `server/plugin-qpd.ts` → `CloudTAK/api/stateless/routes/`

then rebuilds and recreates the CloudTAK API image (5–15 minutes). Defaults to `~/CloudTAK` if you omit the path.

```bash
./install.sh --pull /path/to/CloudTAK     # git pull, then reinstall + rebuild
./install.sh --remove /path/to/CloudTAK   # uninstall + rebuild
./install.sh --no-build /path/to/CloudTAK # copy files only
```

After the rebuild, in CloudTAK go to **Settings → Refresh App** to activate the new service worker. A normal hard-refresh does **not** work — the service worker intercepts requests. Or close all CloudTAK tabs and reopen. The plugin appears at the bottom of the right-side menu.

### Local development

1. Follow the [CloudTAK Develop guide](https://docs.cloudtak.io/develop/) so the API (`api/`) and web (`api/web`) servers are running.
2. Point `plugin/package.json`’s `@tak-ps/cloudtak` `file:` path at your CloudTAK `api/web` package, then:

```bash
cd plugin
npm install
```

3. Symlink the web plugin and copy the server route:

```bash
ln -s /path/to/cloudtak-plugin-quick-point-dropper/plugin \
      /path/to/CloudTAK/api/web/plugins/quick-point-dropper

cp /path/to/cloudtak-plugin-quick-point-dropper/server/plugin-qpd.ts \
   /path/to/CloudTAK/api/stateless/routes/plugin-qpd.ts
```

4. Restart the CloudTAK API so it loads `plugin-qpd.ts`, and restart `npm run serve` in `api/web`.

`api/web/plugins/` is git-ignored in CloudTAK.

## Usage

1. Open **Quick Point Dropper** from the right-side menu.
2. Choose **Favorites** or an icon pack. Toggle the grid button for icon names.
3. Optionally set Title and Remarks (they persist across drops).
4. Tap an icon — the cursor becomes a crosshair. Every map click drops a new point.
5. Tap **Stop** (panel banner or bottom bar) to leave drop mode.
6. With drop mode off, click any point on the map to load it, change Title/Remarks/icon, and tap **Update Point**.
7. System admins can star/unstar icons. Everyone else sees the same Favorites list without star controls.

Closing the plugin panel also exits drop mode.

## How admins are decided

Writes go through `Auth.as_user(config, req, { admin: true })` in [`api/common/auth.ts`](https://github.com/dfpc-coe/CloudTAK/blob/main/api/common/auth.ts). That requires JWT `access === admin`, which CloudTAK sets from `profile.system_admin`. Agency admins cannot change Favorites. Grant system admin in the CloudTAK admin UI or via the OIDC group `CloudTAKSystemAdmin`.

The `GET /api/qpd/favorites` response includes `writable` so the UI can hide stars without decoding the token.

## Persistence

| Data | Where |
| --- | --- |
| Favorite icons | CloudTAK Postgres table `qpd_favorites` (created on API load; survives image rebuilds) |
| Last selected pack, detailed grid | Browser `localStorage` keys `cloudtak-qpd-lastIconset`, `cloudtak-qpd-detailedView` |

## Layout

```
plugin/                 CloudTAK web plugin (Vite glob: plugins/*/index.ts)
  index.ts
  lib/
server/plugin-qpd.ts    Copied to api/stateless/routes/
install.sh
```
