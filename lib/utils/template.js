// Every rule sees one element shape, whichever template syntax it came from:
//
//   {name, node, hasSpread, hasChildren, attributes: Map<normalizedName, Attribute>}
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

// Content between the tags, ignoring whitespace-only text, comments and `{}`
const isJsxContent = (child) => {
  switch (child.type) {
    case 'JSXText': return child.value.trim() !== ''
    case 'JSXExpressionContainer': return child.expression.type !== 'JSXEmptyExpression'
    default: return !child.type.endsWith('Comment')
  }
}

// vue-eslint-parser keeps comments out of `children`
const isVueContent = (child) => child.type !== 'VText' || child.value.trim() !== ''

const fromJsx = (node) => {
  const element = {
    name: jsxName(node.name),
    node,
    hasSpread: false,
    hasChildren: node.parent.children?.some(isJsxContent) ?? false,
    attributes: new Map(),
  }

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
  const element = {
    name: node.rawName,
    node: node.startTag,
    hasSpread: false,
    hasChildren: node.children.some(isVueContent),
    attributes: new Map(),
  }

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

const svelteName = (node) => node.type === 'SvelteMemberExpressionName'
  ? `${ svelteName(node.object) }.${ node.property.name }`
  : node.name

const isSvelteContent = (child) => {
  switch (child.type) {
    case 'SvelteText': return child.value.trim() !== ''
    case 'SvelteHTMLComment': return false
    default: return true
  }
}

// `title="a{b}c"` as a template literal, so rules read it like a JSX
// `title={`a${ b }c`}`: a known head, an unknown rest.
const svelteInterpolation = (parts) => {
  const quasis = []
  const expressions = []
  let text = ''

  for (const part of parts) {
    if (part.type === 'SvelteLiteral') {
      text += part.value
      continue
    }

    quasis.push({type: 'TemplateElement', value: {raw: text, cooked: text}})
    expressions.push(part.expression)
    text = ''
  }

  quasis.push({type: 'TemplateElement', value: {raw: text, cooked: text}})

  return {type: 'TemplateLiteral', quasis, expressions, range: [parts[0].range[0], parts.at(-1).range[1]]}
}

const SVELTE_INERT_ATTRIBUTES = new Set(['innerhtml', 'outerhtml'])

const fromSvelte = (node) => {
  const element = {
    name: svelteName(node.name),
    node: node.startTag,
    hasSpread: false,
    hasChildren: node.children.some(isSvelteContent),
    attributes: new Map(),
  }

  const set = (name, attribute, value, expression) => {
    element.attributes.set(normalizeName(name), {name, node: attribute, value, expression})
  }

  for (const attribute of node.startTag.attributes) {
    switch (attribute.type) {
      case 'SvelteAttribute': {
        const name = attribute.key.name
        const parts = attribute.value

        // Svelte sets these as inert attributes (`innerhtml="…"`), not as the
        // DOM properties; only `bind:innerHTML` writes the property.
        if (SVELTE_INERT_ATTRIBUTES.has(normalizeName(name))) break

        if (parts.length === 0) set(name, attribute, '', null)
        else if (parts.length === 1 && parts[0].type === 'SvelteLiteral') set(name, attribute, parts[0].value, null)
        else if (parts.length === 1) set(name, attribute, staticString(parts[0].expression), parts[0].expression)
        else {
          const expression = svelteInterpolation(parts)

          set(name, attribute, expression.expressions.length === 0 ? expression.quasis[0].value.cooked : undefined, expression)
        }
        break
      }
      // `{srcdoc}`
      case 'SvelteShorthandAttribute':
        set(attribute.key.name, attribute, undefined, attribute.value)
        break
      // `bind:innerHTML={html}` renders the value as HTML, like the attribute
      case 'SvelteDirective':
        if (attribute.kind === 'Binding') set(attribute.key.name.name, attribute, undefined, attribute.expression)
        break
      case 'SvelteSpecialDirective':
        // `<svelte:element this={'a'}>` is an `<a>`
        if (attribute.kind === 'this' && staticString(attribute.expression) !== undefined) element.name = staticString(attribute.expression)
        break
      case 'SvelteSpreadAttribute':
        element.hasSpread = true
        break
    }
  }

  if (element.name === 'svelte:element' && element.attributes.get('this')?.value) element.name = element.attributes.get('this').value

  return element
}

export const defineTemplateVisitor = (context, onElement, scriptVisitor = {}) => {
  const visitor = {
    ...scriptVisitor,
    JSXOpeningElement(node) {
      onElement(fromJsx(node))
    },
    SvelteElement(node) {
      onElement(fromSvelte(node))
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
