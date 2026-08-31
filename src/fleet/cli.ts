#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { FleetStore } from './store.ts';
import { createFleetServer, type AuthMode } from './server.ts';

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '3847' },
    mode: { type: 'string', default: 'loopback' },
    'core-base': { type: 'string', default: 'http://127.0.0.1:25808' },
    db: { type: 'string', default: 'data/fleet.db' },
  },
});

const authMode = (values.mode === 'web' ? 'web' : 'loopback') as AuthMode;
const dbPath = values.db && values.db.length > 0 ? values.db : undefined;
if (dbPath) mkdirSync(dirname(dbPath), { recursive: true });

const store = new FleetStore({ dbPath });
const server = await createFleetServer({
  store,
  host: values.host,
  port: Number(values.port),
  authMode,
  coreBaseUrl: values['core-base'] || null,
});

const addr = server.address();
const port = addr && typeof addr === 'object' ? addr.port : values.port;
console.log(
  `Munder Fleet listening on http://${values.host}:${port} (authMode=${authMode}, db=${dbPath || 'memory'})`,
);
