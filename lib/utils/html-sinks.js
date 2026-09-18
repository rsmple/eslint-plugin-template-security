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

// With both tokens, a document in the frame's own origin can reach the parent
// and remove its `sandbox` attribute, so the sandbox restricts nothing.
export const sandboxCanEscape = (value) => {
  const tokens = new Set(value.toLowerCase().trim().split(/\s+/))

  return tokens.has('allow-scripts') && tokens.has('allow-same-origin')
}

export const calleeName =(sourceCode, expression) => expression.type === 'CallExpression'
  ? sourceCode.getText(expression.callee).replace(/\s+/g, '')
  : undefined
