import {engineOf, isConstantOutput, isScriptAttribute, isScriptType, templateOutput, templateParts} from '../utils/template-engine.js'
import {URL_ATTRIBUTES} from '../utils/template.js'

// Escapers whose output is safe inside a `<script>` or an event handler:
// they escape quotes, `<`, `\` and line breaks for JavaScript rather than HTML.
const SCRIPT_ESCAPERS = [
  /\|\s*(?:tojson|escapejs)\b/, // Jinja, Nunjucks; Django
  /\|\s*(?:e|escape)\s*\(\s*['"]js['"]/, // Twig
  /\bJs\s*::\s*from\b/, // Laravel
  /\b(?:escape_javascript|json_escape|to_json)\b|^j\b/, // Rails
  /\bJSON_HEX_TAG\b|\besc_js\s*\(/, // PHP, WordPress
  /\b(?:escapeEcmaScript|escapeJavaScript|encodeForJavaScript)\b/, // Java
  /\|\s*(?:int|float|length|count|abs)\b|\bintval\s*\(|^\(int\)/, // numbers
]

// URL builders: the engine or framework decides the scheme, not the value
const URL_HELPERS = [
  /^(?:url_for|url|secure_url|route|path|asset|static|esc_url|absolute_url|relative_url|asset_path|image_path|\w+_(?:path|url))\b/,
  /\|\s*(?:url|relative_url|absolute_url|asset_url|file_url|img_url)\b/,
  // A constant from configuration: `{{ STATIC_URL }}`
  /^[A-Z][A-Z\d_]*$/,
]

// Output that writes whole attributes and escapes each value: Jinja's
// `xmlattr`, Blade's `$attributes`, Drupal's `attributes`, Shopify's
// `shopify_attributes`, Rails' `tag.attributes`, Symfony UX `stimulus_*()`
const ATTRIBUTE_WRITERS = [/\|\s*xmlattr\b/, /attributes\b/, /^stimulus_\w+\s*\(/]

const URL_NAMES = new Set(URL_ATTRIBUTES)

export default {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Disallow server template output where HTML escaping does not protect it: `<script>`, event handlers, URL schemes, `srcdoc`, unquoted values and attribute names',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-unsafe-output-context',
    },
    schema: [
      {
        type: 'object',
        properties: {
          escapers: {type: 'array', items: {type: 'string'}, uniqueItems: true},
          urls: {type: 'boolean'},
          urlHelpers: {type: 'array', items: {type: 'string'}, uniqueItems: true},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      script: '`{{output}}` is written into a `<script>`, where HTML escaping does not apply: it can end the string or statement it is in, or the script itself. Serialize it for JavaScript (`|tojson`, `@json`, `json_escape`).',
      scriptAttribute: '`{{attribute}}` is JavaScript, and the browser decodes HTML escapes before running it, so `{{output}}` can end its string. Put the value in a `data-*` attribute and read it from the code, or escape it for JavaScript.',
      url: '`{{attribute}}` starts with `{{output}}`, so the value decides the scheme, and HTML escaping keeps `javascript:`. Start the URL with a fixed path or scheme, or build it with a URL helper.',
      srcdoc: '`srcdoc` is decoded and then parsed as a document, so HTML-escaped `{{output}}` in it becomes markup again.',
      unquoted: 'Unquoted attribute value: HTML escaping leaves spaces, so `{{output}}` can add attributes such as `onfocus`. Quote the value.',
      attributeName: '`{{output}}` writes attributes into the tag, and HTML escaping lets it add event handlers. Write each attribute with a fixed name.',
    },
  },

  create(context) {
    const {escapers = [], urls = false, urlHelpers = []} = context.options[0] ?? {}
    const {sourceCode} = context
    const {text} = sourceCode
    const engine = engineOf(context)

    const byName = (names) => names.map(name => new RegExp(`(?:^|[^\\w$.])${ name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }\\b`))
    const scriptEscapers = [...SCRIPT_ESCAPERS, ...byName(escapers)]
    const urlBuilders = [...URL_HELPERS, ...byName(urlHelpers)]

    const outputs = (node) => templateParts(node)
      .map(part => ({part, output: templateOutput(part, engine, text)}))
      .filter(({output}) => output !== undefined && !isConstantOutput(output.code))

    const report = (part, messageId, data = {}, fix = undefined) => {
      context.report({node: part, messageId, data: {output: part.value, ...data}, fix})
    }

    const checkAttribute = (attribute) => {
      for (const {part, output} of outputs(attribute.key)) {
        if (!ATTRIBUTE_WRITERS.some(pattern => pattern.test(output.code))) report(part, 'attributeName')
      }

      const {value} = attribute
      const found = outputs(value)

      if (found.length === 0) return

      const key = attribute.key.value.toLowerCase()
      const name = attribute.key.value

      if (!attribute.startWrapper) {
        const quote = value.value.includes('"') ? (value.value.includes('\'') ? undefined : '\'') : '"'

        report(found[0].part, 'unquoted', {}, quote && (fixer => [
          fixer.insertTextBeforeRange(value.range, quote),
          fixer.insertTextAfterRange(value.range, quote),
        ]))
      }

      if (isScriptAttribute(key, value.value)) {
        for (const {part, output} of found) {
          if (!scriptEscapers.some(pattern => pattern.test(output.code))) report(part, 'scriptAttribute', {attribute: name})
        }
      } else if (key === 'srcdoc') {
        for (const {part} of found) report(part, 'srcdoc')
      } else if (urls && URL_NAMES.has(key)) {
        // Only output at the start decides the scheme: `/users/{{ id }}` does not
        const first = value.parts.find(part => part.type !== 'Template' ? part.value.trim() !== '' : templateOutput(part, engine, text) !== undefined)
        const start = found.find(({part}) => part === first)

        if (start && !urlBuilders.some(pattern => pattern.test(start.output.code))) report(start.part, 'url', {attribute: name})
      }
    }

    const checkAttributes = (node) => {
      for (const attribute of node.attributes ?? []) checkAttribute(attribute)
    }

    return {
      Tag: checkAttributes,
      StyleTag: checkAttributes,
      ScriptTag(node) {
        checkAttributes(node)

        const type = node.attributes.find(attribute => attribute.key.value.toLowerCase() === 'type')

        if (!isScriptType(type && (type.value?.value ?? ''))) return

        for (const {part, output} of outputs(node.value)) {
          if (!scriptEscapers.some(pattern => pattern.test(output.code))) report(part, 'script')
        }
      },
    }
  },
}
