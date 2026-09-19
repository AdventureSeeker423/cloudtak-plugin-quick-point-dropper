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

interface FavoriteRow {
    iconset: string;
    path: string;
    name: string;
}

async function query<T>(config: ConfigStateless, statement: ReturnType<typeof sql>): Promise<T[]> {
    const result = await config.pg.execute(statement);
    return result as unknown as T[];
}

export default async function router(schema: Schema, config: ConfigStateless) {
    try {
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
    } catch (err) {
        console.error('[qpd] table bootstrap failed', err);
    }

    await schema.get('/qpd/favorites', {
        name: 'List QPD Favorites',
        group: 'QuickPointDropper',
        description: 'Shared Quick Point Dropper favorite icons. Any authenticated user can read; only system admins can write.',
        res: Type.Object({
            favorites: Type.Array(Type.Object({
                iconset: Type.String(),
                path: Type.String(),
                name: Type.String(),
            })),
            writable: Type.Boolean(),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const favorites = await query<FavoriteRow>(config, sql`
                SELECT iconset, path, name FROM qpd_favorites
                ORDER BY name ASC, iconset ASC, path ASC
            `);
            res.json({
                favorites,
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
        }),
        res: Type.Object({
            favorite: Type.Object({
                iconset: Type.String(),
                path: Type.String(),
                name: Type.String(),
            }),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { admin: true });
            const iconset = String(req.body.iconset || '').trim();
            const path = String(req.body.path || '').trim();
            const name = String(req.body.name || '').trim() || path.split('/').pop() || path;
            if (!iconset || !path) throw new Err(400, null, 'iconset and path are required');

            const rows = await query<FavoriteRow>(config, sql`
                INSERT INTO qpd_favorites (iconset, path, name, created_by)
                VALUES (${iconset}, ${path}, ${name}, ${user.email})
                ON CONFLICT (iconset, path) DO UPDATE SET name = ${name}
                RETURNING iconset, path, name
            `);
            res.json({ favorite: rows[0] });
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
}
