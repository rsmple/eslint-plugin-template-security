import {URL_ATTRIBUTES, defineTemplateVisitor, knownPrefixes, normalizeName, normalizeUrl} from '../utils/template.js'

const isJavascriptUrl = (value) => /^javascript:/i.test(normalizeUrl(value))

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow `javascript:` URLs in template URL attributes',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-javascript-url',
    },
    schema: [
      {
        type: 'object',
        properties: {
          attributes: {type: 'array', items: {type: 'string'}, uniqueItems: true},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      javascriptUrl: '`javascript:` URL in `{{attribute}}` runs code when followed. Use an event handler instead.',
    },
  },

  create(context) {
    const {attributes = []} = context.options[0] ?? {}
    const names = [...URL_ATTRIBUTES, ...attributes].map(normalizeName)

    return defineTemplateVisitor(context, (element) => {
      for (const name of names) {
        const attribute = element.attributes.get(name)

        if (!attribute) continue

        const candidates = attribute.value !== undefined ? [attribute.value] : knownPrefixes(attribute.expression)

        if (candidates.some(isJavascriptUrl)) {
          context.report({node: attribute.node, messageId: 'javascriptUrl', data: {attribute: attribute.name}})
        }
      }
    })
  },
}
