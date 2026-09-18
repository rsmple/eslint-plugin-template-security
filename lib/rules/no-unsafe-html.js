import {HTMX_REQUESTS, SINKS, calleeName, contentOf, isConstant, isRawTextElement, isSafeAlpineHtml, sandboxCanEscape, splitByScript} from '../utils/html-sinks.js'
import {hostMatcher, hostOf} from '../utils/hosts.js'
import {defineTemplateVisitor, knownPrefixes, normalizeName} from '../utils/template.js'

const DEFAULT_SANITIZERS = ['DOMPurify.sanitize', 'sanitizeHtml']

// A `srcdoc` document runs in the embedding page's origin unless the frame is
// sandboxed: a static `sandbox` blocks its scripts or gives it an opaque origin.
const isIsolatingSandbox = (sandbox) => sandbox?.value !== undefined && !sandboxCanEscape(sandbox.value)

// `hx-swap="none"` discards the response
const discardsResponse = (attributes) => {
  const swap = attributes.get('hxswap') ?? attributes.get('datahxswap')

  return swap?.value?.trim().toLowerCase().startsWith('none') === true
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow rendering unsanitized HTML through template bindings (`v-html`, `set:html`, `{@html}`, `x-html`, `dangerouslySetInnerHTML`, `innerHTML`, `<iframe srcdoc>`, htmx requests to another origin)',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-unsafe-html',
    },
    schema: [
      {
        type: 'object',
        properties: {
          sanitizers: {type: 'array', items: {type: 'string'}, uniqueItems: true},
          trustedHosts: {type: 'array', items: {type: 'string'}, uniqueItems: true},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsafeHtml: '`{{sink}}` renders its value as HTML without escaping. Pass it through a sanitizer ({{sanitizers}}) or render it as text.',
      unsafeSrcdoc: '`srcdoc` renders its value as a document in this page\'s origin. Pass it through a sanitizer ({{sanitizers}}) or add `sandbox` without `allow-scripts allow-same-origin` together.',
      crossOriginHtmx: '`{{attribute}}` inserts the HTML that {{host}} returns into this page, so that host can run scripts here. Request this origin, or add the host to `trustedHosts`.',
    },
  },

  create(context) {
    const {sanitizers = DEFAULT_SANITIZERS, trustedHosts = []} = context.options[0] ?? {}
    const isTrusted = hostMatcher(trustedHosts)
    const {sourceCode} = context
    const sanitizerSet = new Set(sanitizers)
    const sanitizerList = sanitizers.map(name => `\`${ name }()\``).join(', ') || 'none configured'

    const isSanitized = (html) => isConstant(html) || sanitizerSet.has(calleeName(sourceCode, html))

    // Interpolations inside a `<script>` in the markup are left to `no-unescaped-script-content`
    const isSafe = (html) => isSanitized(html) || splitByScript(html).html.every(isSanitized)

    const svelteVisitor = {
      SvelteMustacheTag(node) {
        if (node.kind !== 'raw' || isSafe(node.expression)) return

        context.report({node, messageId: 'unsafeHtml', data: {sink: '{@html}', sanitizers: sanitizerList}})
      },
    }

    return defineTemplateVisitor(context, (element) => {
      // `<script>` / `<style>` content is not parsed as HTML, so an HTML
      // sanitizer does not apply; `no-unescaped-script-content` covers `<script>`.
      if (isRawTextElement(element)) return

      for (const [key, sink] of SINKS) {
        const attribute = element.attributes.get(key)

        if (!attribute) continue

        if (key === 'xhtml') {
          if (attribute.value !== undefined && isSafeAlpineHtml(attribute.value, sanitizerSet)) continue
        } else if (!attribute.expression || isSafe(contentOf(attribute))) {
          continue
        }

        context.report({
          node: attribute.node,
          messageId: 'unsafeHtml',
          data: {sink, sanitizers: sanitizerList},
        })
      }

      if (!discardsResponse(element.attributes)) {
        for (const key of HTMX_REQUESTS) {
          const attribute = element.attributes.get(key)

          if (!attribute) continue

          // Only URLs known to point elsewhere: a relative or unknown one may be this origin
          const host = (attribute.value !== undefined ? [attribute.value] : knownPrefixes(attribute.expression))
            .map(hostOf)
            .find(candidate => candidate !== undefined && !isTrusted(candidate))

          if (host === undefined) continue

          // A template's head may hold only part of the host
          const origin = attribute.value !== undefined ? `\`${ host }\`` : 'another origin'

          context.report({node: attribute.node, messageId: 'crossOriginHtmx', data: {attribute: attribute.name, host: origin}})
        }
      }

      if (normalizeName(element.name) !== 'iframe') return

      const srcdoc = element.attributes.get('srcdoc')

      if (!srcdoc?.expression || isSafe(srcdoc.expression)) return
      if (isIsolatingSandbox(element.attributes.get('sandbox'))) return

      context.report({
        node: srcdoc.node,
        messageId: 'unsafeSrcdoc',
        data: {sanitizers: sanitizerList},
      })
    }, svelteVisitor)
  },
}
