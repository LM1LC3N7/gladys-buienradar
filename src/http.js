// -----------------------------------------------------------------------------
// The only place that talks to the network: `fetch` with a timeout and a
// User-Agent that names the integration. The tests replace it with
// `setFetch()`.
// -----------------------------------------------------------------------------

import { HTTP_TIMEOUT, USER_AGENT } from './constants.js';

let fetchImpl = (...args) => globalThis.fetch(...args);

/** Replace the fetch implementation (tests only). Returns the previous one. */
export function setFetch(impl) {
  const previous = fetchImpl;
  fetchImpl = impl;
  return previous;
}

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} on ${new URL(url).pathname}${body ? `: ${body}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

async function get(url, accept, timeout) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept },
    // The radar maps answer with a 302 to their CDN.
    redirect: 'follow',
    signal: AbortSignal.timeout(Math.max(1, timeout)),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new HttpError(response.status, url, text.trim().slice(0, 200));
  }
  return response;
}

/** GET a JSON document; throws an HttpError on a non-2xx status. */
export async function getJson(url, { timeout = HTTP_TIMEOUT } = {}) {
  const text = await (await get(url, 'application/json', timeout)).text();
  return text ? JSON.parse(text) : undefined;
}

/** GET a text document. */
export async function getText(url, { timeout = HTTP_TIMEOUT } = {}) {
  return (await get(url, 'text/plain', timeout)).text();
}

/** GET binary content (an image) as a Buffer, with its content type. */
export async function getBytes(url, { timeout = HTTP_TIMEOUT } = {}) {
  const response = await get(url, 'image/png,image/jpeg', timeout);
  return {
    type: response.headers.get('content-type') ?? '',
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}
