import {SINKS, calleeName, contentOf, isConstant, splitByScript} from '../utils/html-sinks.js'
import {defineTemplateVisitor, normalizeName} from '../utils/template.js'

// Serializers documented to escape `<` for embedding in a `<script>`:
// serialize-javascript and devalue.
const DEFAULT_ESCAPERS = ['serialize', 'uneval', 'devalue.uneval']

const ESCAPE = '.replace(/</g, \'\\\\u003c\')'

const propertyName = (member) => member.computed ? member.property.value : member.property.name

// `x.replace(/</g, …)` or `x.replaceAll('<', …)`: every `<` is rewritten, so no
// closing tag can survive. A pattern that only matches `</script` is not
// enough — `<!--` also changes how the rest of the script is tokenized.
const replacesEveryLt = (call) => {
  const method = propertyName(call.callee)
  const [pattern] = call.arguments

  if (pattern?.type !== 'Literal') return false
  if (method === 'replaceAll' && pattern.value === '<') return true
  if (!pattern.regex || !pattern.regex.flags.includes('g')) return false

  try {
    return new RegExp(pattern.regex.pattern, pattern.regex.flags.replace('g', '')).test('<')
  } catch {
    return false
  }
}

const isReplaceCall = (expression) => expression.type === 'CallExpression'
  && expression.callee.type === 'MemberExpression'
  && ['replace', 'replaceAll'].includes(propertyName(expression.callee))

const isJsonStringify = (sourceCode, expression) => calleeName(sourceCode, expression) === 'JSON.stringify'

export default {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Require values written into `<script>` through template bindings to escape `<`',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-unescaped-script-content',
    },
    schema: [
      {
        type: 'object',
        properties: {
          escapers: {type: 'array', items: {type: 'string'}, uniqueItems: true},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unescaped: '`{{sink}}` writes into `<script>` without escaping `<`, so a `</script>` in the value closes the element and the rest is parsed as HTML. Escape it, e.g. `JSON.stringify(x){{escape}}`, or use an escaper ({{escapers}}).',
      escapeLt: 'Escape `<` as `\\u003c`.',
    },
  },

  create(context) {
    const {escapers = DEFAULT_ESCAPERS} = context.options[0] ?? {}
    const {sourceCode} = context
    const escaperSet = new Set(escapers)

    const isEscaped = (expression) => {
      if (escaperSet.has(calleeName(sourceCode, expression))) return true
      if (!isReplaceCall(expression)) return false

      return replacesEveryLt(expression) || isEscaped(expression.callee.object)
    }

    const isSafe = (expression) => {
      switch (expression.type) {
        case 'ConditionalExpression': return isSafe(expression.consequent) && isSafe(expression.alternate)
        case 'LogicalExpression': return isSafe(expression.left) && isSafe(expression.right)
        default: return isConstant(expression) || isEscaped(expression)
      }
    }

    const report = (node, sink, content) => {
      context.report({
        node,
        messageId: 'unescaped',
        data: {
          sink,
          escape: ESCAPE,
          escapers: escapers.map(name => `\`${ name }()\``).join(', ') || 'none configured',
        },
        // Only for `JSON.stringify`: in JSON a `<` appears only inside strings,
        // where `<` decodes back to it. Arbitrary script would break.
        suggest: isJsonStringify(sourceCode, content)
          ? [{messageId: 'escapeLt', fix: fixer => fixer.insertTextAfter(content, ESCAPE)}]
          : [],
      })
    }

    // HTML that builds its own `<script>`: `` `<script>${ JSON.stringify(x) }</script>` ``
    const checkBuiltScript = (sink, html) => {
      for (const expression of splitByScript(html).script) {
        if (!isSafe(expression)) report(expression, sink, expression)
      }
    }

    const svelteVisitor = {
      SvelteMustacheTag(node) {
        if (node.kind === 'raw') checkBuiltScript('{@html}', node.expression)
      },
    }

    return defineTemplateVisitor(context, (element) => {
      // `Script` too: Next.js `<Script dangerouslySetInnerHTML>` renders an inline script
      const isScript = normalizeName(element.name) === 'script'

      for (const [key, sink] of SINKS) {
        const attribute = element.attributes.get(key)

        // `x-html` holds Alpine's JavaScript, not the HTML itself
        if (!attribute?.expression || key === 'xhtml') continue

        const content = contentOf(attribute)

        if (!isScript) checkBuiltScript(sink, content)
        else if (!isSafe(content)) report(attribute.node, sink, content)
      }
    }, svelteVisitor)
  },
}
