import rule from '../lib/rules/no-sandbox-escape.js'
import {astro, jsx, svelte, vue, vueFile} from './testers.js'

const escape = origin => ({messageId: 'sandboxEscape', data: {origin}})
const SAME = 'loading this page\'s origin'
const MAYBE = 'that may load this page\'s origin'
const SRCDOC = 'with `srcdoc`, which has this page\'s origin'
const BLANK = 'without `src`, which has this page\'s origin'

const BOTH = 'allow-scripts allow-same-origin'

jsx.run('no-sandbox-escape (jsx)', rule, {
  valid: [
    {name: 'scripts only', code: '<iframe src="/embed" sandbox="allow-scripts allow-forms" />'},
    {name: 'same-origin only', code: '<iframe src="/embed" sandbox="allow-same-origin" />'},
    {name: 'empty sandbox', code: '<iframe src="/embed" sandbox />'},
    {name: 'no sandbox is out of scope', code: '<iframe src="/embed" />'},
    {name: 'cross-origin src', code: `<iframe src="https://codesandbox.io/embed/x" sandbox="${ BOTH }" />`},
    {name: 'protocol-relative src', code: `<iframe src="//player.example.com/1" sandbox="${ BOTH }" />`},
    {name: 'data: src has an opaque origin', code: `<iframe src="data:text/html,hi" sandbox="${ BOTH }" />`},
    {name: 'template with a cross-origin head', code: `<iframe src={\`https://www.youtube.com/embed/\${ id }\`} sandbox="${ BOTH }" />`},
    {name: 'both branches cross-origin', code: `<iframe src={dev ? 'http://localhost:5173' : 'https://app.example.com'} sandbox="${ BOTH }" />`},
    {name: 'bound sandbox is not read', code: '<iframe src="/embed" sandbox={policy} />'},
    {name: 'spread may carry src', code: `<iframe {...props} sandbox="${ BOTH }" />`},
    {name: 'not an iframe', code: `<Frame src="/embed" sandbox="${ BOTH }" />`},
  ],
  invalid: [
    {name: 'relative src', code: `<iframe src="/embed" sandbox="${ BOTH }" />`, errors: [escape(SAME)]},
    {name: 'token order and case', code: '<iframe src="widget.html" sandbox="Allow-Same-Origin allow-popups ALLOW-SCRIPTS" />', errors: [escape(SAME)]},
    {name: 'bound literal sandbox', code: `<iframe src="/embed" sandbox={'${ BOTH }'} />`, errors: [escape(SAME)]},
    {name: 'srcDoc', code: `<iframe srcDoc={html} sandbox="${ BOTH }" />`, errors: [escape(SRCDOC)]},
    {name: 'srcdoc wins over a cross-origin src', code: `<iframe src="https://x.com" srcdoc="<p>hi</p>" sandbox="${ BOTH }" />`, errors: [escape(SRCDOC)]},
    {name: 'no src', code: `<iframe sandbox="${ BOTH }" />`, errors: [escape(BLANK)]},
    {name: 'empty src', code: `<iframe src="" sandbox="${ BOTH }" />`, errors: [escape(SAME)]},
    {name: 'blob: inherits the origin', code: `<iframe src="blob:https://app.example.com/1" sandbox="${ BOTH }" />`, errors: [escape(SAME)]},
    {name: 'unknown bound src', code: `<iframe src={url} sandbox="${ BOTH }" />`, errors: [escape(MAYBE)]},
    {name: 'template with a relative head', code: `<iframe src={\`/embed/\${ id }\`} sandbox="${ BOTH }" />`, errors: [escape(MAYBE)]},
    {name: 'one relative branch', code: `<iframe src={dev ? '/local' : 'https://app.example.com'} sandbox="${ BOTH }" />`, errors: [escape(MAYBE)]},
  ],
})

vue.run('no-sandbox-escape (vue)', rule, {
  valid: [
    {name: 'cross-origin src', code: vueFile(`<iframe src="https://example.com" sandbox="${ BOTH }" />`)},
    {name: 'v-bind object may carry src', code: vueFile(`<iframe v-bind="attrs" sandbox="${ BOTH }" />`)},
  ],
  invalid: [
    {name: 'relative src', code: vueFile(`<iframe src="/embed" sandbox="${ BOTH }" />`), errors: [escape(SAME)]},
    {name: ':srcdoc', code: vueFile(`<iframe :srcdoc="html" sandbox="${ BOTH }" />`), errors: [escape(SRCDOC)]},
    {name: 'bound src', code: vueFile(`<iframe :src="url" sandbox="${ BOTH }" />`), errors: [escape(MAYBE)]},
    {name: 'bound literal sandbox', code: vueFile(`<iframe src="/embed" :sandbox="'${ BOTH }'" />`), errors: [escape(SAME)]},
  ],
})

astro.run('no-sandbox-escape (astro)', rule, {
  valid: [
    {name: 'scripts only', code: '<iframe srcdoc={html} sandbox="allow-scripts" />'},
  ],
  invalid: [
    {name: 'srcdoc', code: `<iframe srcdoc={html} sandbox="${ BOTH }" />`, errors: [escape(SRCDOC)]},
  ],
})

svelte.run('no-sandbox-escape (svelte)', rule, {
  valid: [
    {name: 'scripts only', code: '<iframe {srcdoc} sandbox="allow-scripts"></iframe>'},
    {name: 'interpolated sandbox is not read', code: '<iframe src="/a" sandbox="allow-scripts {extra}"></iframe>'},
  ],
  invalid: [
    {name: 'shorthand srcdoc', code: `<iframe {srcdoc} sandbox="${ BOTH }"></iframe>`, errors: [escape(SRCDOC)]},
    {name: 'relative src', code: `<iframe src="/widget" sandbox="${ BOTH }"></iframe>`, errors: [escape(SAME)]},
  ],
})
