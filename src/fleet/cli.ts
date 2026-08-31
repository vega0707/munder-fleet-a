#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { FleetStore } from './store.ts';
import { createFleetServer, type AuthMode } from './server.ts';

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '3847' },
    mode: { type: 'string', default: 'loopback' },
    'core-health': { type: 'string', default: 'http://127.0.0.1:25808/health' },
  },
});

const authMode = (values.mode === 'web' ? 'web' : 'loopback') as AuthMode;
const store = new FleetStore();
const server = await createFleetServer({
  store,
  host: values.host,
  port: Number(values.port),
  authMode,
  coreHealthUrl: values['core-health'] || null,
});

const addr = server.address();
const port = addr && typeof addr === 'object' ? addr.port : values.port;
console.log(`Munder Fleet listening on http://${values.host}:${port} (authMode=${authMode})`);
