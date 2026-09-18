import {HTMX_REQUESTS} from '../utils/html-sinks.js'
import {defineTemplateVisitor, knownPrefixes, normalizeName, normalizeUrl} from '../utils/template.js'

// Requests an HTTPS page blocks (scripts, frames, plugins, styles) or warns
// about (form submissions). Images and media are left out: browsers upgrade
// them to `https:` on their own.
const LOADING_ATTRIBUTES = new Map([
  ['script', ['src']],
  ['iframe', ['src']],
  ['frame', ['src']],
  ['object', ['data']],
  ['embed', ['src']],
  ['link', ['href']],
  ['form', ['action']],
  ['button', ['formaction']],
  ['input', ['formaction']],
])

// Attributes that load their URL from any element: htmx requests, and the
// Server-Sent Events and WebSocket extensions' connections
const ANY_ELEMENT_ATTRIBUTES = [...HTMX_REQUESTS, 'sseconnect', 'datasseconnect', 'wsconnect', 'datawsconnect']

// `<link>` fetches its `href` only for these; `canonical`, `alternate` etc. are
// plain references.
const FETCHING_RELS = new Set(['stylesheet', 'preload', 'modulepreload', 'prefetch', 'manifest'])

// Browsers treat loopback as potentially trustworthy, so it is not mixed content.
const isLoopback = (host) => /^(?:localhost|.+\.localhost|127(?:\.\d+){3}|\[::1\])$/i.test(host)

// `http:` (or `ws:`) followed by any slashes: `http:example.com` is
// `http://example.com` too. The host is what follows, up to the first
// delimiter; for a template's head that may be only part of it, which is never
// loopback unless complete.
const INSECURE_URL = /^(http|ws):[/\\]*(\[[^\]]*\]|[^/\\:?#]*)/i

const SECURE_SCHEMES = {http: 'https', ws: 'wss'}

// The URL's insecure scheme, lowercased, if it has one
const insecureScheme = (url) => {
  const match = INSECURE_URL.exec(normalizeUrl(url))

  return match !== null && !isLoopback(match[2]) ? match[1].toLowerCase() : undefined
}

const fetchesHref = (rel) => {
  if (!rel) return false
  if (rel.value === undefined) return true

  return rel.value.toLowerCase().split(/\s+/).some(token => FETCHING_RELS.has(token))
}

export default {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Disallow `http:` URLs for scripts, frames, stylesheets, form targets and htmx requests',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-mixed-content',
    },
    schema: [],
    messages: {
      insecure: '`<{{element}} {{attribute}}>` is an `{{scheme}}:` URL: anyone on the network can read or change this request, and HTTPS pages block or warn about it. Use `{{secure}}:`.',
      useSecure: 'Use `{{secure}}:`.',
    },
  },

  create(context) {
    const {sourceCode} = context

    return defineTemplateVisitor(context, (element) => {
      // `Script` too: Next.js `<Script src>` loads the script like the element
      const tag = normalizeName(element.name)
      const names = [...ANY_ELEMENT_ATTRIBUTES]

      if (LOADING_ATTRIBUTES.has(tag) && (tag !== 'link' || fetchesHref(element.attributes.get('rel')))) {
        names.push(...LOADING_ATTRIBUTES.get(tag))
      }

      for (const name of names) {
        const attribute = element.attributes.get(name)

        if (!attribute) continue

        const urls = attribute.value !== undefined ? [attribute.value] : knownPrefixes(attribute.expression)

        const scheme = urls.map(insecureScheme).find(Boolean)

        if (!scheme) continue

        const secure = SECURE_SCHEMES[scheme]

        // Offered only when the attribute has a single `http:` to rewrite
        const text = sourceCode.getText(attribute.node)
        const schemes = [...text.matchAll(new RegExp(`(?<![a-z])${ scheme }:`, 'gi'))]

        context.report({
          node: attribute.node,
          messageId: 'insecure',
          data: {element: element.name, attribute: attribute.name, scheme, secure},
          suggest: schemes.length === 1
            ? [{
              messageId: 'useSecure',
              data: {secure},
              fix: fixer => {
                const start = attribute.node.range[0] + schemes[0].index

                return fixer.replaceTextRange([start, start + scheme.length + 1], `${ secure }:`)
              },
            }]
            : [],
        })
      }
    })
  },
}
