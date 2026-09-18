import {normalizeName} from './template.js'

// normalized attribute name -> how that syntax is spelled in messages
export const SINKS = new Map([
  ['dangerouslysetinnerhtml', 'dangerouslySetInnerHTML'],
  ['innerhtml', 'innerHTML'],
  ['outerhtml', 'outerHTML'],
  ['set:html', 'set:html'],
  ['vhtml', 'v-html'],
])

// The HTML parser reads these elements' content as raw text up to the closing
// tag, so markup in the value is inert; the risk is the closing tag itself.
const RAW_TEXT_ELEMENTS = new Set(['script', 'style'])

export const isRawTextElement = (element) => RAW_TEXT_ELEMENTS.has(normalizeName(element.name))

// The expression that becomes the element's content: `__html` for React's
// `{__html: x}` wrapper, the bound expression for every other sink.
export const contentOf = (attribute) => {
  const {expression} = attribute

  if (attribute.name !== 'dangerouslySetInnerHTML' || expression?.type !== 'ObjectExpression') return expression

  const html = expression.properties.find(property => property.type === 'Property' && !property.computed
    && (property.key.name ?? property.key.value) === '__html')

  return html ? html.value : expression
}

export const isConstant = (expression) => {
  if (expression.type === 'Literal') return true
  if (expression.type === 'TemplateLiteral') return expression.expressions.length === 0

  return false
}

// A template literal or `+` chain as alternating strings and expressions
const flatten = (expression) => {
  if (expression.type === 'TemplateLiteral') {
    return expression.quasis.flatMap((quasi, index) => index < expression.expressions.length
      ? [quasi.value.cooked ?? '', expression.expressions[index]]
      : [quasi.value.cooked ?? ''])
  }

  if (expression.type === 'BinaryExpression' && expression.operator === '+') return [...flatten(expression.left), ...flatten(expression.right)]
  if (expression.type === 'Literal' && typeof expression.value === 'string') return [expression.value]

  return [expression]
}

// Advances through `text` from `state` ('html', 'tag' inside `<script …`, or
// 'script' content), returning the state at its end.
const scanScript = (state, text) => {
  let index = 0

  for (;;) {
    if (state === 'tag') {
      const end = text.indexOf('>', index)

      if (end === -1) return state

      state = 'script'
      index = end + 1
      continue
    }

    const pattern = state === 'script' ? /<\/script/gi : /<script\b/gi

    pattern.lastIndex = index

    const match = pattern.exec(text)

    if (!match) return state

    state = state === 'script' ? 'html' : 'tag'
    index = match.index + match[0].length
  }
}

// Splits the interpolations of HTML built from a template or concatenation by
// where they land: inside a `<script>` element (`script`), or anywhere else
// (`html`). `` `<script type="application/ld+json">${ JSON.stringify(x) }</script>` ``
// is the usual way to write JSON-LD through `{@html}` in Svelte.
export const splitByScript = (expression) => {
  const script = []
  const html = []
  let state = 'html'

  for (const part of flatten(expression)) {
    if (typeof part === 'string') state = scanScript(state, part)
    else (state === 'script' ? script : html).push(part)
  }

  return {script, html}
}

// With both tokens, a document in the frame's own origin can reach the parent
// and remove its `sandbox` attribute, so the sandbox restricts nothing.
export const sandboxCanEscape = (value) => {
  const tokens = new Set(value.toLowerCase().trim().split(/\s+/))

  return tokens.has('allow-scripts') && tokens.has('allow-same-origin')
}

export const calleeName =(sourceCode, expression) => expression.type === 'CallExpression'
  ? sourceCode.getText(expression.callee).replace(/\s+/g, '')
  : undefined
