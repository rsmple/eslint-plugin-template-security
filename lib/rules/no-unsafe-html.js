import {SINKS, calleeName, contentOf, isConstant, isRawTextElement, sandboxCanEscape} from '../utils/html-sinks.js'
import {defineTemplateVisitor, normalizeName} from '../utils/template.js'

const DEFAULT_SANITIZERS = ['DOMPurify.sanitize', 'sanitizeHtml']

// A `srcdoc` document runs in the embedding page's origin unless the frame is
// sandboxed: a static `sandbox` blocks its scripts or gives it an opaque origin.
const isIsolatingSandbox = (sandbox) => sandbox?.value !== undefined && !sandboxCanEscape(sandbox.value)

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow rendering unsanitized HTML through template bindings (`v-html`, `set:html`, `dangerouslySetInnerHTML`, `innerHTML`, `<iframe srcdoc>`)',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-unsafe-html',
    },
    schema: [
      {
        type: 'object',
        properties: {
          sanitizers: {type: 'array', items: {type: 'string'}, uniqueItems: true},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsafeHtml: '`{{sink}}` renders its value as HTML without escaping. Pass it through a sanitizer ({{sanitizers}}) or render it as text.',
      unsafeSrcdoc: '`srcdoc` renders its value as a document in this page\'s origin. Pass it through a sanitizer ({{sanitizers}}) or add `sandbox` without `allow-scripts allow-same-origin` together.',
    },
  },

  create(context) {
    const {sanitizers = DEFAULT_SANITIZERS} = context.options[0] ?? {}
    const {sourceCode} = context
    const sanitizerSet = new Set(sanitizers)
    const sanitizerList = sanitizers.map(name => `\`${ name }()\``).join(', ') || 'none configured'

    const isSafe = (html) => isConstant(html) || sanitizerSet.has(calleeName(sourceCode, html))

    return defineTemplateVisitor(context, (element) => {
      // `<script>` / `<style>` content is not parsed as HTML, so an HTML
      // sanitizer does not apply; `no-unescaped-script-content` covers `<script>`.
      if (isRawTextElement(element)) return

      for (const [key, sink] of SINKS) {
        const attribute = element.attributes.get(key)

        if (!attribute?.expression) continue
        if (isSafe(contentOf(attribute))) continue

        context.report({
          node: attribute.node,
          messageId: 'unsafeHtml',
          data: {sink, sanitizers: sanitizerList},
        })
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
    })
  },
}
