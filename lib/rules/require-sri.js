import {hostMatcher, hostOf} from '../utils/hosts.js'
import {defineTemplateVisitor, knownPrefixes, normalizeName} from '../utils/template.js'

// `<link>` types that honor `integrity`
const SRI_RELS = new Set(['stylesheet', 'preload', 'modulepreload'])

const supportsIntegrity = (rel) => {
  if (!rel) return false
  if (rel.value === undefined) return true

  return rel.value.toLowerCase().split(/\s+/).some(token => SRI_RELS.has(token))
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require `integrity` and `crossorigin` on scripts and stylesheets from another origin',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#require-sri',
    },
    schema: [
      {
        type: 'object',
        properties: {
          trustedHosts: {type: 'array', items: {type: 'string'}, uniqueItems: true},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingIntegrity: '`<{{element}}>` loads from another origin without `integrity`, so whoever controls that host can change what this page runs. Add an `integrity` hash, or add the host to `trustedHosts` if its content changes by design.',
      missingCrossorigin: '`integrity` on a `<{{element}}>` from another origin needs `crossorigin`, or the browser refuses to load it.',
    },
  },

  create(context) {
    const {trustedHosts = []} = context.options[0] ?? {}
    const isTrusted = hostMatcher(trustedHosts)

    return defineTemplateVisitor(context, (element) => {
      // `Script` too: Next.js `<Script src>` renders a script element
      const tag = normalizeName(element.name)
      const {attributes} = element

      if (tag !== 'script' && !(tag === 'link' && supportsIntegrity(attributes.get('rel')))) return

      const url = attributes.get(tag === 'script' ? 'src' : 'href')

      if (!url) return

      // Only URLs known to point elsewhere: a relative or unknown one may be this origin
      const hosts = (url.value !== undefined ? [url.value] : knownPrefixes(url.expression))
        .map(hostOf)
        .filter(host => host !== undefined)

      if (hosts.every(isTrusted)) return

      const integrity = attributes.get('integrity')

      if (!integrity) {
        if (!element.hasSpread) context.report({node: url.node, messageId: 'missingIntegrity', data: {element: element.name}})

        return
      }

      if (!attributes.has('crossorigin') && !element.hasSpread) {
        context.report({node: integrity.node, messageId: 'missingCrossorigin', data: {element: element.name}})
      }
    })
  },
}
