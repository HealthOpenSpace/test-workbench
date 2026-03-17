import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

/**
 * Vite dev plugin: resolve ITB numeric database IDs via docker exec → MySQL.
 * GET /api/itb-ids?suite=<identifier>&actors=<apiKey1,apiKey2>&org=<orgApiKey>
 */
/**
 * Vite dev plugin: proxy health checks to avoid CORS issues.
 * GET /api/health-proxy?url=<encoded-url>&method=<GET|POST>
 */
function healthProxy(): Plugin {
  return {
    name: 'health-proxy',
    configureServer(server) {
      server.middlewares.use('/api/health-proxy', async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const target = url.searchParams.get('url');
        const method = url.searchParams.get('method') || 'GET';

        if (!target) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(target, { method, signal: controller.signal });
          clearTimeout(timeout);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: resp.status }));
        } catch (err: any) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 0, error: err?.message || 'unreachable' }));
        }
      });
    },
  };
}

function itbIdResolver(): Plugin {
  return {
    name: 'itb-id-resolver',
    configureServer(server) {
      server.middlewares.use('/api/itb-ids', (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const suiteId = url.searchParams.get('suite') || '';
        const actorKeys = (url.searchParams.get('actors') || '').split(',').filter(Boolean);
        const orgKey = url.searchParams.get('org') || '';
        const sysKey = url.searchParams.get('system') || '';
        const communityKey = url.searchParams.get('community') || '';
        const sutActor = url.searchParams.get('sutActor') || '';

        try {
          const sql = `
            SELECT 'community' AS kind, id, api_key AS k FROM Communities WHERE api_key IS NOT NULL
            UNION ALL
            SELECT 'organisation', id, api_key FROM Organizations WHERE api_key IS NOT NULL
            UNION ALL
            SELECT 'system', id, api_key FROM Systems WHERE api_key IS NOT NULL
            UNION ALL
            SELECT 'actor', id, api_key FROM Actors WHERE api_key IS NOT NULL
            UNION ALL
            SELECT 'actor_by_id', id, actorId FROM Actors WHERE actorId IS NOT NULL
            UNION ALL
            SELECT 'testsuite', id, identifier FROM TestSuites WHERE identifier IS NOT NULL;
          `.replace(/\n/g, ' ');

          const raw = execSync(
            `docker exec -e MYSQL_PWD=root itb-gitb-mysql-1 mysql -u root gitb -N -e "${sql}"`,
            { encoding: 'utf-8', timeout: 5000 }
          );

          // Parse tab-separated rows
          const rows = raw.trim().split('\n').map(line => {
            const [kind, id, key] = line.split('\t');
            return { kind, id: Number(id), key };
          });

          const find = (kind: string, key: string) =>
            rows.find(r => r.kind === kind && r.key === key)?.id ?? null;

          const result: Record<string, number | null> = {
            communityId: communityKey ? find('community', communityKey) : null,
            testSuiteId: rows.find(r => r.kind === 'testsuite' && r.key === suiteId)?.id ?? null,
          };

          const dbQuery = (sql: string) => {
            try {
              return execSync(
                `docker exec -e MYSQL_PWD=root itb-gitb-mysql-1 mysql -u root gitb -N -e "${sql}"`,
                { encoding: 'utf-8', timeout: 3000 }
              ).trim();
            } catch { return ''; }
          };

          // Direct lookups from provided keys
          if (orgKey) result.organisationId = find('organisation', orgKey);
          if (sysKey) result.systemId = find('system', sysKey);
          // Prioritize the SUT actor for the execution URL
          if (sutActor) {
            const aid = find('actor', sutActor) ?? find('actor_by_id', sutActor);
            if (aid) result.actorId = aid;
          }
          // Fallback: try other actors from the deploy response
          if (!result.actorId) {
            for (const ak of actorKeys) {
              const aid = find('actor', ak) ?? find('actor_by_id', ak);
              if (aid) { result.actorId = aid; break; }
            }
          }

          // Resolve org from system owner
          if (!result.organisationId && result.systemId) {
            const v = dbQuery(`SELECT owner FROM Systems WHERE id = ${result.systemId}`);
            if (v) result.organisationId = Number(v) || null;
          }

          // Resolve org from community (first org with API key)
          if (!result.organisationId && result.communityId) {
            const v = dbQuery(`SELECT id FROM Organizations WHERE community = ${result.communityId} AND api_key IS NOT NULL ORDER BY id LIMIT 1`);
            if (v) result.organisationId = Number(v) || null;
          }

          // Resolve community from org
          if (!result.communityId && result.organisationId) {
            const v = dbQuery(`SELECT community FROM Organizations WHERE id = ${result.organisationId}`);
            if (v) result.communityId = Number(v) || null;
          }

          // Resolve system from org (first system owned by this org)
          if (!result.systemId && result.organisationId) {
            const v = dbQuery(`SELECT id FROM Systems WHERE owner = ${result.organisationId} ORDER BY id DESC LIMIT 1`);
            if (v) result.systemId = Number(v) || null;
          }

          // Resolve system from conformance with the found actor (if system still missing)
          if (!result.systemId && result.actorId) {
            const v = dbQuery(`SELECT sut_id FROM SystemImplementsActors WHERE actor_id = ${result.actorId} ORDER BY sut_id DESC LIMIT 1`);
            if (v) result.systemId = Number(v) || null;
          }

          // Resolve actor from test suite specification (if actor still missing)
          if (!result.actorId && result.testSuiteId) {
            const v = dbQuery(`SELECT a.id FROM SpecificationHasTestSuites shts JOIN SpecificationHasActors sha ON sha.spec_id = shts.spec JOIN Actors a ON a.id = sha.actor_id WHERE shts.testsuite = ${result.testSuiteId} LIMIT 1`);
            if (v) result.actorId = Number(v) || null;
          }

          // Look up API keys for resolved actor and system (for auto-conformance)
          const apiKeys: Record<string, string | null> = { actorApiKey: null, systemApiKey: null, specId: null };
          if (result.actorId) {
            apiKeys.actorApiKey = dbQuery(`SELECT api_key FROM Actors WHERE id = ${result.actorId}`) || null;
          }
          if (result.systemId) {
            apiKeys.systemApiKey = dbQuery(`SELECT api_key FROM Systems WHERE id = ${result.systemId}`) || null;
          }
          // Find the specification that owns the test suite
          if (result.testSuiteId) {
            apiKeys.specId = dbQuery(`SELECT spec FROM SpecificationHasTestSuites WHERE testsuite = ${result.testSuiteId} LIMIT 1`) || null;
          }
          // Auto-create conformance via REST API (DB inserts don't trigger snapshot generation)
          if (apiKeys.systemApiKey && apiKeys.actorApiKey) {
            try {
              // Find an org API key to authenticate
              const orgApiKey = result.organisationId
                ? dbQuery(`SELECT api_key FROM Organizations WHERE id = ${result.organisationId}`)
                : '';
              if (orgApiKey) {
                const { execSync: es } = require('child_process');
                es(`curl -s -X PUT "http://localhost:10003/api/rest/conformance/${apiKeys.systemApiKey}/${apiKeys.actorApiKey}" -H "ITB_API_KEY: ${orgApiKey}"`, { timeout: 5000 });
              }
            } catch { /* conformance may already exist — ignore */ }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ...result, ...apiKeys }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Failed to query ITB database' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), healthProxy(), itbIdResolver()],
  // Use environment variable for base path, fallback to /test-workbench/ for GitHub Pages
  base: process.env.VITE_BASE_PATH || '/test-workbench/',
  optimizeDeps: {
    include: ['monaco-editor']
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
  },
  css: {
    postcss: './postcss.config.js'
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/itb-proxy': {
        target: 'http://localhost:10003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/itb-proxy/, ''),
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  worker: {
    format: 'es'
  }
})