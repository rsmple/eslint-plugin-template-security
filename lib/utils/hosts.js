import {normalizeUrl} from './template.js'

// An absolute or protocol-relative URL, and its host up to the first delimiter.
// For a template's head the host may be incomplete, and then matches no entry.
const CROSS_ORIGIN_URL = /^(?:https?:)?[/\\]{2}([^/\\?#]*)/i

// The host of a URL known to point to another origin, without the port;
// `undefined` for a relative URL, which may be this origin.
export const hostOf = (url) => CROSS_ORIGIN_URL.exec(normalizeUrl(url))?.[1].toLowerCase().replace(/:\d*$/, '')

// Matches a host against `trustedHosts` entries: exact, or `*.example.com` for subdomains
export const hostMatcher = (entries) => {
  const trusted = entries.map(entry => entry.toLowerCase())

  return (host) => trusted.some(entry => entry.startsWith('*.')
    ? host.endsWith(entry.slice(1))
    : host === entry)
}
