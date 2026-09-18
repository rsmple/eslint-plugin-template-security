import {engineOf, isConstantOutput, isScriptAttribute, templateOutput, templateParts} from '../utils/template-engine.js'

// Syntax that opts an escaped output out of escaping
const RAW_MARKERS = [
  [/\|\s*safe(?:seq)?\b/, 'Remove `|safe`'], // Jinja, Django, Nunjucks
  [/\|\s*raw\b/, 'Remove `|raw`'], // Twig
  [/^raw\b|\.html_safe\s*$/, 'Remove `raw` / `html_safe`'], // Rails
]

// How to get escaped output back, for syntax that is unescaped as written
const RAW_SYNTAX = [
  [/^\{!!/, 'Use `{{ }}`'], // Blade
  [/^\{\{\s*[{&]/, 'Use `{{ }}`'], // Handlebars, Mustache
  [/^<%==/, 'Use `<%= %>`'], // ERB
  [/^<%-/, 'Use `<%= %>`'], // EJS
  [/^<\?/, 'Wrap it in `htmlspecialchars()` or `esc_html()`'], // PHP
  [/^\$\{|^<%=/, 'Use `<c:out>` or `fn:escapeXml()`'], // JSP
  [/^\{\{/, 'Add `| escape`'], // Liquid
]

// Calls and filters whose result is safe to write as is: escapers, sanitizers,
// and helpers that build their own markup (partials, CSRF fields, pagination)
const DEFAULT_SANITIZERS = [
  // PHP, Laravel, WordPress
  'htmlspecialchars', 'htmlentities', 'e', 'esc_html', 'esc_attr', 'esc_url', 'esc_textarea',
  'esc_html__', 'esc_attr__', 'esc_html_x', 'esc_attr_x', 'wp_kses', 'wp_kses_post', 'wp_kses_data',
  'absint', 'intval', 'clean', 'csrf_field', 'method_field', 'links', 'get_avatar', 'get_search_form',
  'get_search_query', 'get_the_post_thumbnail', 'wp_get_attachment_image', 'paginate_links', 'wp_nonce_field',
  // Java
  'escapeXml', 'escapeHtml4', 'htmlEscape', 'encodeForHTML', 'encodeForHTMLAttribute',
  // Jinja, Twig, Liquid filters; Rails
  'escape', 'escape_once', 'url_encode', 'url_escape', 'sanitize',
  // EJS and Hexo partials, URL builders
  'include', 'partial', 'render', 'url_for',
]

// A layout's slot for the rendered page: Handlebars `{{{body}}}`, EJS `<%- body %>`
const LAYOUT_BODY = /^body$/

const escapeRegExp = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// `{% autoescape false %}` (Jinja, Twig), `{% autoescape off %}` (Django)
const AUTOESCAPE_OFF = /^\{%-?\s*autoescape\s+(?:false|off)\b/

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow server template output that skips HTML escaping (`|safe`, `|raw`, `{!! !!}`, `{{{ }}}`, `<%== %>`, `<?= ?>`, JSP `${}`)',
      recommended: true,
      url: 'https://github.com/rsmple/eslint-plugin-template-security#no-unescaped-output',
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
      unescaped: '`{{output}}` is written without HTML escaping, so markup in the value becomes part of the page. {{fix}}, or pass it through a sanitizer if it has to stay HTML.',
      autoescapeOff: '`{{output}}` turns off HTML escaping for every output inside it. Keep escaping on, and mark single sanitized values as safe instead.',
    },
  },

  create(context) {
    const {sanitizers = []} = context.options[0] ?? {}
    const {text} = context.sourceCode
    const engine = engineOf(context)

    // Liquid escapes nothing, so every output would be reported; the rule
    // cannot tell the ones holding user data apart.
    if (engine === 'liquid') return {}

    // `name(…)` or `| name`, not a longer name that ends with it
    const names = [...DEFAULT_SANITIZERS, ...sanitizers].map(escapeRegExp).join('|')
    const sanitizing = new RegExp(`(?<![\\w$])(?:${ names })\\s*\\(|\\|\\s*(?:${ names })\\b|^\\(int\\)`)

    const check = (node) => {
      for (const part of templateParts(node)) {
        if (AUTOESCAPE_OFF.test(part.value)) {
          context.report({node: part, messageId: 'autoescapeOff', data: {output: part.value}})
          continue
        }

        const output = templateOutput(part, engine, text)

        if (!output || isConstantOutput(output.code) || LAYOUT_BODY.test(output.code) || sanitizing.test(output.code)) continue

        const marker = RAW_MARKERS.find(([pattern]) => pattern.test(output.code))

        if (output.escaped && !marker) continue

        const fix = marker?.[1] ?? RAW_SYNTAX.find(([pattern]) => pattern.test(part.value))?.[1] ?? 'Escape it'

        context.report({node: part, messageId: 'unescaped', data: {output: part.value, fix}})
      }
    }

    const checkAttributes = (node) => {
      // A JSP tag library element (`<c:out value="${x}">`) takes its
      // attributes as values; its own output is what reaches the page.
      if (node.name?.includes(':')) return

      for (const attribute of node.attributes ?? []) {
        // Attribute names and JavaScript values are `no-unsafe-output-context`'s:
        // escaped or not, output does not belong there.
        if (attribute.value && !isScriptAttribute(attribute.key.value.toLowerCase(), attribute.value.value)) check(attribute.value)
      }
    }

    return {
      Text: check,
      Tag: checkAttributes,
      ScriptTag: checkAttributes,
      StyleTag(node) {
        checkAttributes(node)
        check(node.value)
      },
    }
  },
}
