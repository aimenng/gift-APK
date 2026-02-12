/**
 * One-time database initialisation script.
 * Runs schema.sql + all migration files against Supabase via the REST SQL endpoint.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
}

const supabaseDir = path.resolve(__dirname, '..', 'supabase');

// Order matters: schema first, then migrations sorted by date
const files = [
    'schema.sql',
    'migration_20260209_email_binding.sql',
    'migration_20260210_binding_pending_constraints.sql',
    'migration_20260210_focus_stats_cloud.sql',
    'migration_20260210_period_tracker_sync.sql',
    'migration_20260211_invite_code_format_guard.sql',
    'migration_20260211_rls_policies_lockdown.sql',
    'migration_20260211_token_version.sql',
];

async function runSQL(sql, label) {
    // Use Supabase REST SQL endpoint (pg-meta / rpc)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ query: sql }),
    });

    if (!res.ok) {
        // Fallback: try the pg-meta SQL endpoint
        const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-connection-encrypted': 'true',
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        });
        if (!res2.ok) {
            const text = await res2.text();
            throw new Error(`[${label}] HTTP ${res2.status}: ${text}`);
        }
        return res2;
    }
    return res;
}

async function main() {
    console.log('🔄 Initialising Supabase database...\n');

    for (const file of files) {
        const filePath = path.join(supabaseDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Skipping ${file} (not found)`);
            continue;
        }
        const sql = fs.readFileSync(filePath, 'utf-8');
        try {
            await runSQL(sql, file);
            console.log(`✅ ${file}`);
        } catch (err) {
            console.error(`❌ ${file}: ${err.message}`);
        }
    }

    console.log('\n🎉 Database initialisation complete!');
}

main();
