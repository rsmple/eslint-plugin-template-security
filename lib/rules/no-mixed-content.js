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

// `<link>` fetches its `href` only for these; `canonical`, `alternate` etc. are
// plain references.
const FETCHING_RELS = new Set(['stylesheet', 'preload', 'modulepreload', 'prefetch', 'manifest'])

// Browsers treat loopback as potentially trustworthy, so it is not mixed content.
const isLoopback = (host) => /^(?:localhost|.+\.localhost|127(?:\.\d+){3}|\[::1\])$/i.test(host)

// `http:` followed by any slashes: `http:example.com` is `http://example.com`
// too. The host is what follows, up to the first delimiter; for a template's
// head that may be only part of it, which is never loopback unless complete.
const INSECURE_URL = /^http:[/\\]*(\[[^\]]*\]|[^/\\:?#]*)/i

const isInsecure = (url) => {
  const match = INSECURE_URL.exec(normalizeUrl(url))

  return match !== null && !isLoopback(match[1])
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
      description: 'Disallow `http:` URLs for scripts, frames, stylesheets and form targets',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-mixed-content',
    },
    schema: [],
    messages: {
      insecure: '`<{{element}} {{attribute}}>` is an `http:` URL: anyone on the network can read or change this request, and HTTPS pages block or warn about it. Use `https:`.',
      useHttps: 'Use `https:`.',
    },
  },

  create(context) {
    const {sourceCode} = context

    return defineTemplateVisitor(context, (element) => {
      // `Script` too: Next.js `<Script src>` loads the script like the element
      const tag = normalizeName(element.name)
      const names = LOADING_ATTRIBUTES.get(tag)

      if (!names) return
      if (tag === 'link' && !fetchesHref(element.attributes.get('rel'))) return

      for (const name of names) {
        const attribute = element.attributes.get(name)

        if (!attribute) continue

        const urls = attribute.value !== undefined ? [attribute.value] : knownPrefixes(attribute.expression)

        if (!urls.some(isInsecure)) continue

        // Offered only when the attribute has a single `http:` to rewrite
        const text = sourceCode.getText(attribute.node)
        const schemes = [...text.matchAll(/http:/gi)]

        context.report({
          node: attribute.node,
          messageId: 'insecure',
          data: {element: element.name, attribute: attribute.name},
          suggest: schemes.length === 1
            ? [{
              messageId: 'useHttps',
              fix: fixer => {
                const start = attribute.node.range[0] + schemes[0].index

                return fixer.replaceTextRange([start, start + 'http:'.length], 'https:')
              },
            }]
            : [],
        })
      }
    })
  },
}
