import {defineTemplateVisitor, normalizeName} from '../utils/template.js'

const LINK_ELEMENTS = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['form', 'action'],
])

// Every other target — `_blank` and any named window — opens a new browsing
// context that gets `window.opener`. Browsers imply `noopener` for `_blank` only.
const SAME_CONTEXT_TARGETS = new Set(['', '_self', '_parent', '_top', '_unfencedtop'])

const EXTERNAL_URL = /^\s*(?:https?:)?\/\//i

const splitTokens = (value) => value.trim().split(/\s+/).filter(Boolean)

export default {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require `rel="noopener"` on links that open a new window to another origin',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#link-noopener',
    },
    schema: [
      {
        type: 'object',
        properties: {
          components: {
            type: 'object',
            additionalProperties: {type: 'string'},
          },
          noreferrer: {type: 'boolean'},
          dynamicLinks: {type: 'boolean'},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingRel: 'This link opens a new window that can navigate this page through `window.opener`. Add `rel="{{rel}}"`.',
      incompleteRel: '`rel` is missing `{{missing}}`, so the opened window can navigate this page through `window.opener`.',
      missingNoreferrer: '`rel` is missing `noreferrer`, so the full URL of this page is sent to the linked site.',
    },
  },

  create(context) {
    const {components = {}, noreferrer = false, dynamicLinks = true} = context.options[0] ?? {}
    const required = noreferrer ? ['noopener', 'noreferrer'] : ['noopener']

    const urlAttributes = new Map(LINK_ELEMENTS)

    for (const [name, attribute] of Object.entries(components)) urlAttributes.set(normalizeName(name), normalizeName(attribute))

    return defineTemplateVisitor(context, (element) => {
      const urlAttributeName = urlAttributes.get(normalizeName(element.name))

      if (!urlAttributeName) return

      const {attributes, hasSpread} = element
      const target = attributes.get('target')

      if (!target) return
      if (target.value !== undefined && SAME_CONTEXT_TARGETS.has(target.value.trim().toLowerCase())) return

      const url = attributes.get(urlAttributeName)

      if (!url) return
      if (url.value !== undefined ? !EXTERNAL_URL.test(url.value) : !dynamicLinks) return

      const rel = attributes.get('rel')

      if (!rel) {
        // the spread may well carry `rel`
        if (hasSpread) return

        context.report({
          node: target.node,
          messageId: 'missingRel',
          data: {rel: required.join(' ')},
          fix: fixer => fixer.insertTextAfter(target.node, ` rel="${ required.join(' ') }"`),
        })
        return
      }

      if (rel.value === undefined) return

      const tokens = splitTokens(rel.value)
      const present = new Set(tokens.map(token => token.toLowerCase()))

      // `noreferrer` implies `noopener`
      const hasNoopener = present.has('noopener') || present.has('noreferrer')
      const missing = required.filter(token => !present.has(token) && !(token === 'noopener' && hasNoopener))

      if (missing.length === 0) return

      context.report({
        node: rel.node,
        messageId: hasNoopener ? 'missingNoreferrer' : 'incompleteRel',
        data: {missing: missing.join(' ')},
        fix: fixer => fixer.replaceText(rel.node, `rel="${ [...tokens, ...missing].join(' ') }"`),
      })
    })
  },
}
