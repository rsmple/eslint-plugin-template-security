import {normalizeUrl, staticString} from '../utils/template.js'

const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self', 'top', 'parent'])
const SAME_CONTEXT_TARGETS = new Set(['_self', '_parent', '_top', '_unfencedtop'])

const isGlobalReference = (identifier, scope) => {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(identifier.name)

    if (variable) return variable.defs.length === 0
  }

  return true
}

const propertyName = (member) => {
  if (!member.computed) return member.property.type === 'Identifier' ? member.property.name : null

  return staticString(member.property) ?? null
}

// `location.origin`, `window.location.origin`, …
const isOriginReference = (node) => node.type === 'MemberExpression'
  && propertyName(node) === 'origin'
  && ((node.object.type === 'Identifier' && node.object.name === 'location')
    || (node.object.type === 'MemberExpression' && propertyName(node.object) === 'location'
      && node.object.object.type === 'Identifier' && GLOBAL_OBJECTS.has(node.object.object.name)))

const isRelative = (url) => url !== '' && !/^([a-z][a-z\d+.-]*:|[/\\]{2})/i.test(normalizeUrl(url))

// A URL on this page's origin: the opened page is this site's own, so its
// `window.opener` handle gives it nothing it does not already have.
const isSameOrigin = (url) => {
  switch (url.type) {
    case 'Literal': return typeof url.value === 'string' && isRelative(url.value)
    case 'TemplateLiteral': {
      const head = url.quasis[0].value.cooked

      return head === '' ? url.expressions.length > 0 && isOriginReference(url.expressions[0]) : isRelative(head)
    }
    case 'BinaryExpression': return url.operator === '+' && isSameOrigin(url.left)
    case 'ConditionalExpression': return isSameOrigin(url.consequent) && isSameOrigin(url.alternate)
    default: return isOriginReference(url)
  }
}

// A feature is on when it is present without a value, or with `yes` / a non-zero integer.
const hasFeature = (features, names) => features.split(/[\s,]+/).some(feature => {
  const [name, value] = feature.split('=').map(part => part.trim().toLowerCase())

  if (!names.includes(name)) return false
  if (value === undefined || value === '' || value === 'yes') return true

  const number = Number.parseInt(value, 10)

  return !Number.isNaN(number) && number !== 0
})

export default {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Require the `noopener` feature when `window.open()` opens a new browsing context',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#window-open-noopener',
    },
    schema: [],
    messages: {
      missingNoopener: '`window.open()` without `noopener` lets the opened page navigate this one through `window.opener`.',
      addNoopener: 'Pass `noopener` in the window features.',
    },
  },

  create(context) {
    const {sourceCode} = context

    const isWindowOpen = (callee, node) => {
      const scope = sourceCode.getScope(node)

      if (callee.type === 'Identifier') return callee.name === 'open' && isGlobalReference(callee, scope)
      if (callee.type !== 'MemberExpression' || propertyName(callee) !== 'open') return false

      return callee.object.type === 'Identifier' && GLOBAL_OBJECTS.has(callee.object.name) && isGlobalReference(callee.object, scope)
    }

    const suggestFix = (node, features) => {
      // with `noopener` the call returns null, so code holding the handle would break
      if (node.parent.type !== 'ExpressionStatement') return undefined

      return [{
        messageId: 'addNoopener',
        fix: (fixer) => {
          if (!features) {
            const [url, target] = node.arguments
            const tail = target ? ', \'noopener\'' : `${ url ? '' : 'undefined' }, '_blank', 'noopener'`

            return fixer.insertTextAfter(target ?? url ?? sourceCode.getTokenAfter(node.callee), tail)
          }

          const text = sourceCode.getText(features)
          const quote = text[0]
          const value = staticString(features).trim()

          return fixer.replaceText(features, `${ quote }${ value ? `${ value },` : '' }noopener${ quote }`)
        },
      }]
    }

    return {
      CallExpression(node) {
        if (!isWindowOpen(node.callee, node)) return
        if (node.arguments.some(argument => argument.type === 'SpreadElement')) return

        const [url, target, features] = node.arguments

        if (url && isSameOrigin(url)) return

        const targetValue = staticString(target)

        if (targetValue !== undefined && SAME_CONTEXT_TARGETS.has(targetValue.trim().toLowerCase())) return

        if (features) {
          const featuresValue = staticString(features)

          if (featuresValue === undefined || hasFeature(featuresValue, ['noopener', 'noreferrer'])) return
        }

        context.report({node, messageId: 'missingNoopener', suggest: suggestFix(node, features)})
      },
    }
  },
}
