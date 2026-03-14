// ITB (Interoperability Test Bed) REST API client
import JSZip from 'jszip';
import type { GeneratedFile } from '../parser/xmlGenerator';

export interface ITBConfig {
  baseUrl: string;         // e.g. http://localhost:10003
  deployPath: string;      // e.g. /api/rest/testsuite/deploy
  apiKey?: string;         // optional API key for authentication
  specificationId?: string; // target specification ID for deployment
  organisationApiKey?: string; // organisation API key for test execution
  systemApiKey?: string;       // system API key for test execution
  // Numeric IDs for ITB UI URLs (not available via REST API)
  communityId?: string;
  organisationId?: string;
  systemId?: string;
  actorId?: string;
  testSuiteId?: string;
}

export interface ITBDeployResult {
  success: boolean;
  message: string;
  details?: any;
  url?: string;            // the URL that was called
}

const STORAGE_KEY = 'itb-config';

/**
 * Defaults come from .env (VITE_ITB_*) with sensible fallbacks.
 */
function envDefaults(): ITBConfig {
  return {
    baseUrl: import.meta.env.VITE_ITB_BASE_URL || 'http://localhost:10003',
    deployPath: import.meta.env.VITE_ITB_DEPLOY_PATH || '/api/rest/testsuite/deploy',
    apiKey: import.meta.env.VITE_ITB_API_KEY || undefined,
    specificationId: import.meta.env.VITE_ITB_SPECIFICATION_ID || undefined,
  };
}

export function loadITBConfig(): ITBConfig {
  const defaults = envDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch { /* ignore */ }
  return defaults;
}

export function saveITBConfig(config: ITBConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Rewrite an ITB URL to go through the Vite dev proxy when the
 * target origin differs from the current page (avoids CORS).
 */
function proxyUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  try {
    const target = new URL(base);
    const current = window.location;
    const sameOrigin =
      target.hostname === current.hostname && target.port === current.port;
    if (sameOrigin) return `${base}${path}`;
  } catch { /* invalid URL — fall through to proxy */ }
  return `/itb-proxy${path}`;
}

/**
 * Build a ZIP archive from the generated XML files.
 */
async function buildZip(files: GeneratedFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.xml);
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Deploy a test suite ZIP to the ITB instance.
 */
export async function deployToITB(
  files: GeneratedFile[],
  config: ITBConfig
): Promise<ITBDeployResult> {
  if (!config.baseUrl) {
    return { success: false, message: 'ITB base URL is not configured.' };
  }

  const zipBlob = await buildZip(files);

  const form = new FormData();
  form.append('testSuite', zipBlob, 'testsuite.zip');
  form.append('updateSpecification', 'true');
  if (config.specificationId) {
    form.append('specification', config.specificationId);
  }

  const deployPath = config.deployPath || '/api/rest/testsuite/deploy';
  const url = proxyUrl(config.baseUrl, deployPath);
  const targetUrl = `${config.baseUrl.replace(/\/+$/, '')}${deployPath}`;

  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['ITB_API_KEY'] = config.apiKey;
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
    });

    const contentType = resp.headers.get('content-type') || '';
    let body: any;
    if (contentType.includes('json')) {
      body = await resp.json();
    } else {
      body = await resp.text();
    }

    if (resp.ok) {
      return {
        success: true,
        message: `Deployed successfully (${resp.status}).`,
        details: body,
        url: targetUrl,
      };
    } else {
      const errMsg = typeof body === 'string'
        ? body.substring(0, 200)
        : body?.message || body?.error || JSON.stringify(body).substring(0, 200);
      return {
        success: false,
        message: `${resp.status} from POST ${deployPath}: ${errMsg}`,
        details: body,
        url: targetUrl,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Connection error: ${err?.message || err}`,
      url: targetUrl,
    };
  }
}

/**
 * Quick health check — just try to reach the ITB base.
 */
export async function checkITBHealth(baseUrl: string): Promise<{ ok: boolean; message: string }> {
  // Try the root URL — any response (even 404) means the server is running
  const url = proxyUrl(baseUrl, '/');
  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return { ok: true, message: `ITB reachable (${resp.status})` };
  } catch (err: any) {
    return { ok: false, message: `Cannot reach ITB: ${err?.message || err}` };
  }
}

/**
 * Probe common REST API paths to help discover the right deploy endpoint.
 */
export async function discoverEndpoints(baseUrl: string): Promise<{ path: string; status: number }[]> {
  const candidates = [
    '/api/rest/testsuite/deploy',
    '/rest/api/testsuite/deploy',
    '/api/v1/testsuite/deploy',
    '/gitb/api/rest/testsuite/deploy',
    '/api/rest/testsuite',
    '/api/rest',
    '/api',
  ];

  const results: { path: string; status: number }[] = [];

  for (const path of candidates) {
    try {
      const url = proxyUrl(baseUrl, path);
      const resp = await fetch(url, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(3000),
      });
      results.push({ path, status: resp.status });
    } catch {
      // skip unreachable paths
    }
  }

  return results;
}

// ── Test Execution ──────────────────────────────────────────────────

export interface ITBTestResult {
  sessionId?: string;
  result?: string;   // SUCCESS, FAILURE, UNDEFINED
  message: string;
  details?: any;
}

/**
 * Get actors for the specification (to find actor API keys for test execution).
 */
export async function getSpecificationActors(config: ITBConfig): Promise<any[]> {
  if (!config.specificationId) return [];
  const url = proxyUrl(config.baseUrl, `/api/rest/specification/${config.specificationId}/actors`);
  const headers: Record<string, string> = {};
  if (config.apiKey) headers['ITB_API_KEY'] = config.apiKey;
  try {
    const resp = await fetch(url, { headers });
    if (resp.ok) return await resp.json();
  } catch { /* ignore */ }
  return [];
}

/**
 * Get or create a system for test execution.
 */
export async function ensureSystem(config: ITBConfig): Promise<string | null> {
  if (config.systemApiKey) return config.systemApiKey;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['ITB_API_KEY'] = config.apiKey;

  // Create a system
  const url = proxyUrl(config.baseUrl, '/api/rest/system');
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        shortName: 'TestSUT',
        fullName: 'Test System Under Test',
        description: 'Auto-created by Gherkin FHIR Compiler',
        version: '1.0',
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.apiKey || null;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Ensure a conformance statement exists between system and actor.
 */
export async function ensureConformance(config: ITBConfig, systemApiKey: string, actorApiKey: string): Promise<boolean> {
  const url = proxyUrl(config.baseUrl, `/api/rest/conformance/${systemApiKey}/${actorApiKey}`);
  const headers: Record<string, string> = {};
  if (config.apiKey) headers['ITB_API_KEY'] = config.apiKey;
  try {
    const resp = await fetch(url, { method: 'PUT', headers });
    return resp.ok;
  } catch { return false; }
}

/**
 * Start a test execution via ITB REST API.
 */
export async function startTest(
  config: ITBConfig,
  testCaseIds: string[],
  systemApiKey: string,
  actorApiKey: string,
): Promise<ITBTestResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['ITB_API_KEY'] = config.apiKey;
  const url = proxyUrl(config.baseUrl, '/api/rest/tests/start');

  const results: ITBTestResult[] = [];

  for (const testId of testCaseIds) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          testCase: testId,
          system: systemApiKey,
          actor: actorApiKey,
          forceSequentialExecution: true,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        // Wait for result
        const sessionId = data.sessionId || data.session;
        if (sessionId) {
          const statusResult = await pollTestStatus(config, sessionId);
          results.push(statusResult);
        } else {
          results.push({ message: 'Test started but no session ID returned', details: data });
        }
      } else {
        results.push({ message: `Failed to start test: ${data?.message || resp.status}`, details: data });
      }
    } catch (err: any) {
      results.push({ message: `Error: ${err?.message || err}` });
    }
  }
  return results;
}

/**
 * Poll test status until completion.
 */
async function pollTestStatus(config: ITBConfig, sessionId: string): Promise<ITBTestResult> {
  const headers: Record<string, string> = {};
  if (config.apiKey) headers['ITB_API_KEY'] = config.apiKey;
  const url = proxyUrl(config.baseUrl, `/api/rest/tests/status`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sessionId }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.result && data.result !== 'UNDEFINED') {
          return {
            sessionId,
            result: data.result,
            message: `Test ${data.result}`,
            details: data,
          };
        }
      }
    } catch { /* retry */ }
  }
  return { sessionId, result: 'UNDEFINED', message: 'Test timed out waiting for result' };
}

/**
 * Resolve ITB numeric database IDs from API keys / identifiers.
 * Calls the Vite dev middleware at /api/itb-ids which queries MySQL via docker exec.
 */
export async function resolveITBIds(
  config: ITBConfig,
  deployDetails: any,
  sutActorId?: string,
): Promise<{ communityId?: number; organisationId?: number; systemId?: number; actorId?: number; testSuiteId?: number }> {
  const suiteId = deployDetails?.identifiers?.testSuite || '';
  const actorKeys = (deployDetails?.identifiers?.specifications?.[0]?.actors || [])
    .map((a: any) => a.identifier)
    .filter(Boolean);
  const orgKey = config.organisationApiKey || '';
  const sysKey = config.systemApiKey || '';
  const communityKey = config.apiKey || '';

  const params = new URLSearchParams({
    suite: suiteId,
    actors: actorKeys.join(','),
    org: orgKey,
    system: sysKey,
    community: communityKey,
    sutActor: sutActorId || '',
  });

  try {
    const resp = await fetch(`/api/itb-ids?${params}`);
    if (resp.ok) {
      const data = await resp.json();
      console.log('[ITB] /api/itb-ids response:', data);
      return data;
    }
    console.warn('[ITB] /api/itb-ids returned', resp.status, await resp.text().catch(() => ''));
  } catch (err) {
    console.warn('[ITB] /api/itb-ids fetch failed:', err);
  }
  return {};
}

/**
 * Build the ITB UI URL — full execution URL if numeric IDs are available,
 * otherwise just the app home page.
 *
 * Full format: {base}/app#/admin/users/community/{c}/organisation/{o}/test/{s}/{a}/execute?ts={ts}
 */
export function getITBAppUrl(config: ITBConfig, ids?: { communityId?: number; organisationId?: number; systemId?: number; actorId?: number; testSuiteId?: number }): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  const c = ids?.communityId || config.communityId;
  const o = ids?.organisationId || config.organisationId;
  const s = ids?.systemId || config.systemId;
  const a = ids?.actorId || config.actorId;
  const ts = ids?.testSuiteId || config.testSuiteId;
  if (c && o && s && a && ts) {
    return `${base}/app#/admin/users/community/${c}/organisation/${o}/test/${s}/${a}/execute?ts=${ts}`;
  }
  return `${base}/app`;
}
