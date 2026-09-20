# Quick Point Dropper

A CloudTAK plugin for dropping and editing map points quickly.

Pick an icon, click the map, and a CoT point is created. Click an existing point to change its title, remarks, icon, or location. Shared **Favorites** sit at the top of the menu so the icons you use most are one tap away.

Requires CloudTAK **13.45** or newer.

## What it does

- Drop points from **Favorites**, CloudTAK’s four **Standard** points (unknown, friendly, hostile, neutral), or any icon pack
- Type a **Title / Callsign** and **Notes / Remarks** that apply to the next drop
- Paste coordinates (**DD, DM, DMS, MGRS, or UTM**) to place or move a point without clicking the map
- **Enumerate Points** appends a running number to each dropped callsign
- Click an existing point to edit it in place: retitle, rewrite remarks, **Move**, **Change Icon**, or **Delete**
- **Favorites** are shared for everyone on the server. Only a CloudTAK system admin can add, remove, or arrange them

## Install

Do not use CloudTAK’s `WEB_PLUGINS` setting. Use this installer:

```bash
git clone https://github.com/AdventureSeeker423/cloudtak-plugin-quick-point-dropper.git
cd cloudtak-plugin-quick-point-dropper
./install.sh
```

The script finds CloudTAK at `$CLOUDTAK`, `~/CloudTAK`, `/home/takwerx/CloudTAK`, or `/home/*/CloudTAK`. If yours is somewhere else:

```bash
./install.sh /path/to/CloudTAK
```

The first install rebuilds the CloudTAK API image (about 5–15 minutes). Run the same `./install.sh` later to update.

After it finishes, in CloudTAK go to **Settings → Refresh App**. A normal browser refresh is not enough. The plugin appears at the bottom of the right-side menu.

```bash
./install.sh --remove
```

## How to use

1. Open **Quick Point Dropper** from the right-side menu.
2. Choose **Favorites**, **Standard**, or an icon pack. Search to filter; use the list/grid button to show names.
3. Tap an icon. The cursor becomes a crosshair — each map click drops a new point.
4. Optional: set Title / Callsign, Notes / Remarks, or paste coordinates before you drop.
5. Tap **Stop Dropping Points** in the bottom bar, or press **Escape**, to leave drop mode.
6. With drop mode off, click a point on the map to edit it. Overlapping points use CloudTAK’s picker.
7. System admins tap **Edit Favorites** to star icons and arrange sections.

Closing the plugin also stops drop mode.

## Key commands

These apply while the plugin is open. **Ctrl** is Control, not Command.

| Key | When | Action |
| --- | --- | --- |
| **Escape** | Dropping | Stop dropping and clear the title, remarks, and selected icon |
| **Escape** | A point is selected | Deselect that point |
| **Escape** | Move or Change Icon | Cancel that mode |
| **Escape** | Edit Favorites | Close the editor |
| **Ctrl+M** | A point is selected | Start **Move** |
| **Ctrl+I** | A point is selected | Start **Change Icon** |
| **Delete** or **Backspace** (twice) | A point is selected | Same as **Delete** — first press asks to confirm, second press deletes |
| Any letter or number | A point is selected | Clear the title and start typing a new one |
| **Enter** | Coordinates field | Place or move the point at those coordinates |

Shortcuts do not run while you are typing in a text box. Type a title or remarks first, or click the map, then use the keys above.
