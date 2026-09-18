// Every rule sees one element shape, whichever template syntax it came from:
//
//   {name, node, hasSpread, attributes: Map<normalizedName, Attribute>}
//   Attribute = {name, node, value, expression}
//
// `value` is the attribute's string when it is statically known and `undefined`
// when it is bound to an expression. `expression` is the bound ESTree node, if any.
// Names are normalized (lowercased, hyphens dropped) so `innerHTML`, `inner-html`
// and `innerhtml` compare equal across JSX and Vue.

export const normalizeName = (name) => name.toLowerCase().replaceAll('-', '')

export const staticString = (expression) => {
  if (!expression) return undefined
  if (expression.type === 'Literal' && typeof expression.value === 'string') return expression.value
  if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) return expression.quasis[0].value.cooked

  return undefined
}

// Browsers strip leading C0 controls and spaces, and tabs/newlines anywhere,
// before reading the scheme — so `\tjava\nscript:` still runs.
export const normalizeUrl = (value) => value.replace(/^[\x00-\x20]+/, '').replace(/[\t\n\r]/g, '')

// The strings a bound value is known to start with: the whole literal, the head
// of a template or `+` concatenation, each branch of a conditional.
export const knownPrefixes = (expression) => {
  if (!expression) return []

  switch (expression.type) {
    case 'Literal': return typeof expression.value === 'string' ? [expression.value] : []
    case 'TemplateLiteral': return [expression.quasis[0].value.cooked]
    case 'BinaryExpression': return expression.operator === '+' ? knownPrefixes(expression.left) : []
    case 'ConditionalExpression': return [...knownPrefixes(expression.consequent), ...knownPrefixes(expression.alternate)]
    case 'LogicalExpression': return [...knownPrefixes(expression.left), ...knownPrefixes(expression.right)]
    default: return []
  }
}

const jsxName = (node) => {
  switch (node.type) {
    case 'JSXIdentifier': return node.name
    case 'JSXNamespacedName': return `${ node.namespace.name }:${ node.name.name }`
    case 'JSXMemberExpression': return `${ jsxName(node.object) }.${ node.property.name }`
    default: return ''
  }
}

const fromJsx = (node) => {
  const element = {name: jsxName(node.name), node, hasSpread: false, attributes: new Map()}

  for (const attribute of node.attributes) {
    if (attribute.type === 'JSXSpreadAttribute') {
      element.hasSpread = true
      continue
    }

    const name = jsxName(attribute.name)
    const raw = attribute.value
    let value
    let expression = null

    if (raw === null) value = ''
    else if (raw.type === 'Literal') value = String(raw.value)
    else {
      // JSXExpressionContainer, or astro-eslint-parser's bare TemplateLiteral value
      expression = raw.type === 'JSXExpressionContainer' ? raw.expression : raw

      if (expression.type === 'JSXEmptyExpression') expression = null
      else value = staticString(expression)
    }

    element.attributes.set(normalizeName(name), {name, node: attribute, value, expression})
  }

  return element
}

const fromVue = (node) => {
  const element = {name: node.rawName, node: node.startTag, hasSpread: false, attributes: new Map()}

  for (const attribute of node.startTag.attributes) {
    if (!attribute.directive) {
      const name = attribute.key.rawName
      const value = attribute.value ? attribute.value.value : ''

      element.attributes.set(normalizeName(name), {name, node: attribute, value, expression: null})
      continue
    }

    const directive = attribute.key.name.name
    const expression = attribute.value?.expression ?? null

    if (directive === 'html') {
      element.attributes.set('vhtml', {name: 'v-html', node: attribute, value: staticString(expression), expression})
    } else if (directive === 'bind') {
      const argument = attribute.key.argument

      // `v-bind="object"` and `:[dynamicName]` can set any attribute
      if (argument?.type !== 'VIdentifier') {
        element.hasSpread = true
        continue
      }

      element.attributes.set(normalizeName(argument.rawName), {name: argument.rawName, node: attribute, value: staticString(expression), expression})
    }
  }

  return element
}

export const defineTemplateVisitor = (context, onElement, scriptVisitor = {}) => {
  const visitor = {
    ...scriptVisitor,
    JSXOpeningElement(node) {
      onElement(fromJsx(node))
    },
  }

  const defineTemplateBodyVisitor = context.sourceCode.parserServices?.defineTemplateBodyVisitor

  if (!defineTemplateBodyVisitor) return visitor

  return defineTemplateBodyVisitor(
    {
      VElement(node) {
        onElement(fromVue(node))
      },
    },
    visitor,
  )
}
