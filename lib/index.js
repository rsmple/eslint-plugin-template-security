import {createRequire} from 'node:module'
import linkNoopener from './rules/link-noopener.js'
import noHtmlWithChildren from './rules/no-html-with-children.js'
import noJavascriptUrl from './rules/no-javascript-url.js'
import noMixedContent from './rules/no-mixed-content.js'
import noSandboxEscape from './rules/no-sandbox-escape.js'
import noUnescapedScriptContent from './rules/no-unescaped-script-content.js'
import noUnsafeHtml from './rules/no-unsafe-html.js'
import requireSri from './rules/require-sri.js'
import windowOpenNoopener from './rules/window-open-noopener.js'

// `package.json` is the single source for the name and version; `npm version` updates only it
const {name, version} = createRequire(import.meta.url)('../package.json')

const plugin = {
  meta: {name, version},
  rules: {
    'link-noopener': linkNoopener,
    'no-html-with-children': noHtmlWithChildren,
    'no-javascript-url': noJavascriptUrl,
    'no-mixed-content': noMixedContent,
    'no-sandbox-escape': noSandboxEscape,
    'no-unescaped-script-content': noUnescapedScriptContent,
    'no-unsafe-html': noUnsafeHtml,
    'require-sri': requireSri,
    'window-open-noopener': windowOpenNoopener,
  },
  configs: {},
}

plugin.configs.recommended = {
  name: 'template-security/recommended',
  plugins: {'template-security': plugin},
  rules: {
    'template-security/link-noopener': 'error',
    'template-security/no-html-with-children': 'error',
    'template-security/no-javascript-url': 'error',
    'template-security/no-mixed-content': 'error',
    'template-security/no-sandbox-escape': 'error',
    'template-security/no-unescaped-script-content': 'error',
    'template-security/no-unsafe-html': 'error',
    'template-security/require-sri': 'error',
    'template-security/window-open-noopener': 'error',
  },
}

export default plugin
export const {meta, rules, configs} = plugin
