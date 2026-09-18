import {SINKS} from '../utils/html-sinks.js'
import {defineTemplateVisitor} from '../utils/template.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow children on an element whose content is set by an HTML binding',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-html-with-children',
    },
    schema: [],
    messages: {
      htmlWithChildren: '`{{sink}}` replaces this element\'s content, so its children are never shown (React throws instead). Keep one of the two.',
    },
  },

  create(context) {
    return defineTemplateVisitor(context, (element) => {
      // A `children` prop is the same content passed as an attribute
      if (!element.hasChildren && !element.attributes.has('children')) return

      for (const [key, sink] of SINKS) {
        const attribute = element.attributes.get(key)

        if (attribute) context.report({node: attribute.node, messageId: 'htmlWithChildren', data: {sink}})
      }
    })
  },
}
