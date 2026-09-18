import {sandboxCanEscape} from '../utils/html-sinks.js'
import {defineTemplateVisitor, knownPrefixes, normalizeName, normalizeUrl} from '../utils/template.js'

// Documents from these schemes inherit the embedding page's origin.
const INHERITING_SCHEMES = new Set(['about', 'blob', 'javascript'])

// An absolute URL with a scheme of its own, or a protocol-relative one. `data:`
// documents get an opaque origin. Another `https:` host could still be this
// site, but that cannot be told from the template.
const isOtherOrigin = (url) => {
  const normalized = normalizeUrl(url)

  if (/^[/\\]{2}/.test(normalized)) return true

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1].toLowerCase()

  return scheme !== undefined && !INHERITING_SCHEMES.has(scheme)
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow `sandbox` with both `allow-scripts` and `allow-same-origin` on a same-origin `<iframe>`',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-sandbox-escape',
    },
    schema: [],
    messages: {
      sandboxEscape: '`sandbox` allows both `allow-scripts` and `allow-same-origin` on a frame {{origin}}, so its scripts can remove the sandbox. Drop one of the two.',
    },
  },

  create(context) {
    return defineTemplateVisitor(context, (element) => {
      if (normalizeName(element.name) !== 'iframe') return

      const sandbox = element.attributes.get('sandbox')

      if (sandbox?.value === undefined || !sandboxCanEscape(sandbox.value)) return

      const {attributes} = element
      const src = attributes.get('src')
      let origin

      // `srcdoc` wins over `src`; no `src` means `about:blank`, which the parent can write into
      if (attributes.has('srcdoc')) origin = 'with `srcdoc`, which has this page\'s origin'
      else if (!src && element.hasSpread) return
      else if (!src) origin = 'without `src`, which has this page\'s origin'
      else {
        const urls = src.value !== undefined ? [src.value] : knownPrefixes(src.expression)

        if (urls.length > 0 && urls.every(isOtherOrigin)) return

        origin = src.value !== undefined ? 'loading this page\'s origin' : 'that may load this page\'s origin'
      }

      context.report({node: sandbox.node, messageId: 'sandboxEscape', data: {origin}})
    })
  },
}
