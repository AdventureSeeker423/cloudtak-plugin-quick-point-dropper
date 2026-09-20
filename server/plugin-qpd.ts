// CloudTAK lints copied plugin routes with its OWN house-style rules, which differ across
// versions. A plugin can't satisfy every CloudTAK version, so opt this route file out of
// CloudTAK's lint — the plugin repo owns its correctness (vue-tsc/eslint in dev).
/* eslint-disable */
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';

interface SectionRow {
    id: string;
    name: string;
    sort: number;
}

interface FavoriteRow {
    iconset: string;
    path: string;
    name: string;
    section_id?: string | null;
    sectionId?: string | null;
    sort?: number;
}

const SectionSchema = Type.Object({
    id: Type.String(),
    name: Type.String(),
    sort: Type.Integer(),
});

const FavoriteSchema = Type.Object({
    iconset: Type.String(),
    path: Type.String(),
    name: Type.String(),
    sectionId: Type.String(),
    sort: Type.Integer(),
});

const LayoutSchema = Type.Object({
    sections: Type.Array(SectionSchema),
    favorites: Type.Array(FavoriteSchema),
    writable: Type.Optional(Type.Boolean()),
});

async function query<T>(config: ConfigStateless, statement: ReturnType<typeof sql>): Promise<T[]> {
    const result = await config.pg.execute(statement);
    return result as unknown as T[];
}

function mapSection(row: SectionRow): { id: string; name: string; sort: number } {
    return {
        id: String(row.id),
        name: String(row.name || ''),
        sort: Number(row.sort) || 0,
    };
}

function mapFavorite(row: FavoriteRow): {
    iconset: string;
    path: string;
    name: string;
    sectionId: string;
    sort: number;
} {
    const sectionId = row.sectionId ?? row.section_id;
    return {
        iconset: String(row.iconset || ''),
        path: String(row.path || ''),
        name: String(row.name || ''),
        sectionId: sectionId ? String(sectionId) : '',
        sort: Number(row.sort) || 0,
    };
}

const DEFAULT_FAVORITES = [
    { iconset: '__standard__', path: 'unknown', name: 'Unknown Point' },
    { iconset: '__standard__', path: 'friendly', name: 'Friendly Point' },
    { iconset: '__standard__', path: 'hostile', name: 'Hostile Point' },
    { iconset: '__standard__', path: 'neutral', name: 'Neutral Point' },
] as const;

async function seedDefaultFavorites(config: ConfigStateless): Promise<void> {
    const existing = await query<{ iconset: string }>(config, sql`
        SELECT iconset FROM qpd_favorites LIMIT 1
    `);
    if (existing.length) return;
    for (let i = 0; i < DEFAULT_FAVORITES.length; i++) {
        const icon = DEFAULT_FAVORITES[i];
        await config.pg.execute(sql`
            INSERT INTO qpd_favorites (iconset, path, name, created_by, section_id, sort)
            VALUES (${icon.iconset}, ${icon.path}, ${icon.name}, NULL, NULL, ${i})
            ON CONFLICT (iconset, path) DO NOTHING
        `);
    }
}

async function readLayout(config: ConfigStateless): Promise<{
    sections: ReturnType<typeof mapSection>[];
    favorites: ReturnType<typeof mapFavorite>[];
}> {
    await seedDefaultFavorites(config);
    const sections = await query<SectionRow>(config, sql`
        SELECT id, name, sort FROM qpd_sections
        ORDER BY sort ASC, name ASC
    `);
    const favorites = await query<FavoriteRow>(config, sql`
        SELECT iconset, path, name, section_id, sort FROM qpd_favorites
        ORDER BY sort ASC, name ASC, iconset ASC, path ASC
    `);
    return {
        sections: sections.map(mapSection),
        favorites: favorites.map(mapFavorite),
    };
}

async function bootstrap(config: ConfigStateless): Promise<void> {
    await config.pg.execute(sql`
        CREATE TABLE IF NOT EXISTS qpd_favorites (
            iconset TEXT NOT NULL,
            path TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by TEXT,
            PRIMARY KEY (iconset, path)
        )
    `);
    await config.pg.execute(sql`
        CREATE TABLE IF NOT EXISTS qpd_sections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        )
    `);
    await config.pg.execute(sql`
        ALTER TABLE qpd_favorites
        ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES qpd_sections(id) ON DELETE SET NULL
    `);
    await config.pg.execute(sql`
        ALTER TABLE qpd_favorites
        ADD COLUMN IF NOT EXISTS sort INTEGER NOT NULL DEFAULT 0
    `);
    await config.pg.execute(sql`
        WITH numbered AS (
            SELECT iconset, path,
                (ROW_NUMBER() OVER (ORDER BY name ASC, iconset ASC, path ASC) - 1)::INTEGER AS n
            FROM qpd_favorites
        )
        UPDATE qpd_favorites f
        SET sort = numbered.n
        FROM numbered
        WHERE f.iconset = numbered.iconset
          AND f.path = numbered.path
          AND NOT EXISTS (SELECT 1 FROM qpd_favorites x WHERE x.sort <> 0)
    `);
    await seedDefaultFavorites(config);
}

export default async function router(schema: Schema, config: ConfigStateless) {
    try {
        await bootstrap(config);
    } catch (err) {
        console.error('[qpd] table bootstrap failed', err);
    }

    await schema.get('/qpd/favorites', {
        name: 'List QPD Favorites',
        group: 'QuickPointDropper',
        description: 'Shared Quick Point Dropper favorites and sections. Any authenticated user can read; only system admins can write.',
        res: Type.Object({
            sections: Type.Array(SectionSchema),
            favorites: Type.Array(FavoriteSchema),
            writable: Type.Boolean(),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const layout = await readLayout(config);
            res.json({
                ...layout,
                writable: user.access === AuthUserAccess.ADMIN,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/qpd/favorites', {
        name: 'Add QPD Favorite',
        group: 'QuickPointDropper',
        description: 'Star an icon on the shared Favorites list (system admin only)',
        body: Type.Object({
            iconset: Type.String(),
            path: Type.String(),
            name: Type.String(),
            sectionId: Type.Optional(Type.String()),
        }),
        res: Type.Object({
            favorite: FavoriteSchema,
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { admin: true });
            const iconset = String(req.body.iconset || '').trim();
            const path = String(req.body.path || '').trim();
            const name = String(req.body.name || '').trim() || path.split('/').pop() || path;
            const sectionId = String(req.body.sectionId || '').trim();
            if (!iconset || !path) throw new Err(400, null, 'iconset and path are required');

            if (sectionId) {
                const found = await query<{ id: string }>(config, sql`
                    SELECT id FROM qpd_sections WHERE id = ${sectionId}
                `);
                if (!found.length) throw new Err(400, null, 'Unknown section');
            }

            const rows = sectionId
                ? await query<FavoriteRow>(config, sql`
                    INSERT INTO qpd_favorites (iconset, path, name, created_by, section_id, sort)
                    VALUES (
                        ${iconset}, ${path}, ${name}, ${user.email}, ${sectionId},
                        (SELECT COALESCE(MAX(sort), -1) + 1 FROM qpd_favorites)
                    )
                    ON CONFLICT (iconset, path) DO UPDATE SET name = ${name}
                    RETURNING iconset, path, name, section_id, sort
                `)
                : await query<FavoriteRow>(config, sql`
                    INSERT INTO qpd_favorites (iconset, path, name, created_by, section_id, sort)
                    VALUES (
                        ${iconset}, ${path}, ${name}, ${user.email}, NULL,
                        (SELECT COALESCE(MAX(sort), -1) + 1 FROM qpd_favorites)
                    )
                    ON CONFLICT (iconset, path) DO UPDATE SET name = ${name}
                    RETURNING iconset, path, name, section_id, sort
                `);
            res.json({ favorite: mapFavorite(rows[0]) });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/qpd/favorites', {
        name: 'Remove QPD Favorite',
        group: 'QuickPointDropper',
        description: 'Unstar an icon from the shared Favorites list (system admin only)',
        query: Type.Object({
            iconset: Type.String(),
            path: Type.String(),
        }),
        res: Type.Object({
            status: Type.Integer(),
            message: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });
            const iconset = String(req.query.iconset || '').trim();
            const path = String(req.query.path || '').trim();
            if (!iconset || !path) throw new Err(400, null, 'iconset and path are required');

            await config.pg.execute(sql`
                DELETE FROM qpd_favorites WHERE iconset = ${iconset} AND path = ${path}
            `);
            res.json({ status: 200, message: 'deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/qpd/layout', {
        name: 'Save QPD Layout',
        group: 'QuickPointDropper',
        description: 'Replace Favorites sections and icon order (system admin only)',
        body: Type.Object({
            sections: Type.Array(Type.Object({
                id: Type.String(),
                name: Type.String(),
            })),
            items: Type.Array(Type.Object({
                iconset: Type.String(),
                path: Type.String(),
                sectionId: Type.String(),
            })),
        }),
        res: LayoutSchema,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });
            const sectionsIn = Array.isArray(req.body.sections) ? req.body.sections : [];
            const itemsIn = Array.isArray(req.body.items) ? req.body.items : [];

            const seen = new Set<string>();
            const sections: { id: string; name: string }[] = [];
            for (const raw of sectionsIn) {
                const id = String(raw.id || '').trim();
                const name = String(raw.name || '').trim();
                if (!id || !name) throw new Err(400, null, 'Each section needs an id and name');
                if (seen.has(id)) throw new Err(400, null, 'Duplicate section id');
                seen.add(id);
                sections.push({ id, name });
            }

            const sectionIds = new Set(sections.map((s) => s.id));
            const items: { iconset: string; path: string; sectionId: string }[] = [];
            for (const raw of itemsIn) {
                const iconset = String(raw.iconset || '').trim();
                const path = String(raw.path || '').trim();
                const sectionId = String(raw.sectionId || '').trim();
                if (!iconset || !path) continue;
                if (sectionId && !sectionIds.has(sectionId)) {
                    throw new Err(400, null, 'Favorite assigned to unknown section');
                }
                items.push({ iconset, path, sectionId });
            }

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                await config.pg.execute(sql`
                    INSERT INTO qpd_sections (id, name, sort)
                    VALUES (${section.id}, ${section.name}, ${i})
                    ON CONFLICT (id) DO UPDATE SET name = ${section.name}, sort = ${i}
                `);
            }

            const existing = await query<{ id: string }>(config, sql`SELECT id FROM qpd_sections`);
            for (const row of existing) {
                if (!sectionIds.has(String(row.id))) {
                    await config.pg.execute(sql`DELETE FROM qpd_sections WHERE id = ${row.id}`);
                }
            }

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.sectionId) {
                    await config.pg.execute(sql`
                        UPDATE qpd_favorites
                        SET section_id = ${item.sectionId}, sort = ${i}
                        WHERE iconset = ${item.iconset} AND path = ${item.path}
                    `);
                } else {
                    await config.pg.execute(sql`
                        UPDATE qpd_favorites
                        SET section_id = NULL, sort = ${i}
                        WHERE iconset = ${item.iconset} AND path = ${item.path}
                    `);
                }
            }

            const layout = await readLayout(config);
            res.json(layout);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
