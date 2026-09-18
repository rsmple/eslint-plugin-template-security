import rule from '../lib/rules/no-unsafe-html.js'
import {astro, html, jsx, svelte, vue, vueFile} from './testers.js'

const unsafe = sink => ({messageId: 'unsafeHtml', data: {sink, sanitizers: '`DOMPurify.sanitize()`, `sanitizeHtml()`'}})
const srcdoc = {messageId: 'unsafeSrcdoc', data: {sanitizers: '`DOMPurify.sanitize()`, `sanitizeHtml()`'}}

jsx.run('no-unsafe-html (jsx)', rule, {
  valid: [
    {name: 'constant __html', code: '<div dangerouslySetInnerHTML={{__html: \'<b>hi</b>\'}} />'},
    {name: 'sanitized __html', code: '<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(html)}} />'},
    {name: 'sanitizeHtml()', code: '<div innerHTML={sanitizeHtml(html)} />'},
    {name: 'constant innerHTML (Solid)', code: '<div innerHTML="<b>hi</b>" />'},
    {name: 'text child', code: '<div>{html}</div>'},
    {
      name: 'custom sanitizer',
      options: [{sanitizers: ['purify']}],
      code: '<div innerHTML={purify(html)} />',
    },
    {name: 'constant srcDoc', code: '<iframe srcDoc="<p>hi</p>" />'},
    {name: 'sanitized srcDoc', code: '<iframe srcDoc={DOMPurify.sanitize(html)} />'},
    {name: 'empty sandbox', code: '<iframe sandbox="" srcDoc={html} />'},
    {name: 'boolean sandbox', code: '<iframe sandbox srcDoc={html} />'},
    {name: 'sandbox with scripts only', code: '<iframe sandbox="allow-scripts allow-popups" srcDoc={html} />'},
    {name: 'sandbox with same-origin only', code: '<iframe sandbox={"allow-same-origin"} srcDoc={html} />'},
    {name: 'srcDoc on a component is a prop', code: '<Preview srcDoc={html} />'},
  ],
  invalid: [
    {name: 'dynamic __html', code: '<div dangerouslySetInnerHTML={{__html: html}} />', errors: [unsafe('dangerouslySetInnerHTML')]},
    {name: 'object passed through', code: '<div dangerouslySetInnerHTML={markup} />', errors: [unsafe('dangerouslySetInnerHTML')]},
    {name: 'dynamic innerHTML (Solid)', code: '<div innerHTML={html} />', errors: [unsafe('innerHTML')]},
    {name: 'interpolated template', code: '<div innerHTML={`<b>${ name }</b>`} />', errors: [unsafe('innerHTML')]},
    {name: 'on a component', code: '<Card dangerouslySetInnerHTML={{__html: html}} />', errors: [unsafe('dangerouslySetInnerHTML')]},
    {
      name: 'default sanitizers are replaced, not merged',
      options: [{sanitizers: ['purify']}],
      code: '<div innerHTML={DOMPurify.sanitize(html)} />',
      errors: [{messageId: 'unsafeHtml', data: {sink: 'innerHTML', sanitizers: '`purify()`'}}],
    },
    {name: 'srcDoc (React)', code: '<iframe srcDoc={html} />', errors: [srcdoc]},
    {name: 'srcdoc (Solid)', code: '<iframe srcdoc={`<p>${ name }</p>`} />', errors: [srcdoc]},
    {name: 'sandbox that can be lifted', code: '<iframe sandbox="allow-same-origin allow-scripts" srcDoc={html} />', errors: [srcdoc]},
    {name: 'bound sandbox is not trusted', code: '<iframe sandbox={policy} srcDoc={html} />', errors: [srcdoc]},
  ],
})

vue.run('no-unsafe-html (vue)', rule, {
  valid: [
    {name: 'text interpolation', code: vueFile('<div>{{ html }}</div>')},
    {name: 'sanitized v-html', code: vueFile('<div v-html="DOMPurify.sanitize(html)" />')},
    {name: 'constant v-html', code: vueFile('<div v-html="\'<br>\'" />')},
    {name: 'static innerHTML attribute is inert', code: vueFile('<div innerHTML="<b>x</b>" />')},
    {name: 'script block is not a template', code: vueFile('<div />', 'const vHtml = html')},
    {name: 'static srcdoc', code: vueFile('<iframe srcdoc="<p>hi</p>" />')},
    {name: 'sandboxed :srcdoc', code: vueFile('<iframe sandbox="allow-scripts" :srcdoc="html" />')},
  ],
  invalid: [
    {name: 'v-html', code: vueFile('<div v-html="html" />'), errors: [unsafe('v-html')]},
    {name: ':innerHTML', code: vueFile('<div :innerHTML="html" />'), errors: [unsafe('innerHTML')]},
    {name: 'v-bind:inner-html.prop', code: vueFile('<div v-bind:inner-html.prop="html" />'), errors: [unsafe('innerHTML')]},
    {name: 'nested element', code: vueFile('<section><p v-html="post.body" /></section>'), errors: [unsafe('v-html')]},
    {name: ':srcdoc', code: vueFile('<iframe :srcdoc="html" />'), errors: [srcdoc]},
    {name: 'bound sandbox', code: vueFile('<iframe :sandbox="policy" :srcdoc="html" />'), errors: [srcdoc]},
  ],
})

astro.run('no-unsafe-html (astro)', rule, {
  valid: [
    {name: 'constant set:html', code: '<Fragment set:html="<br>" />'},
    {name: 'sanitized set:html', code: '<div set:html={DOMPurify.sanitize(html)} />'},
    {name: 'expression child', code: '<div>{html}</div>'},
    {name: 'script is left to no-unescaped-script-content', code: '<script type="application/ld+json" set:html={JSON.stringify(data)} />'},
    {name: 'style is raw text, not HTML', code: '<style is:inline set:html={keyframes} />'},
    {name: 'sandboxed srcdoc', code: '<iframe sandbox srcdoc={html} />'},
  ],
  invalid: [
    {name: 'set:html', code: '---\nconst {html} = Astro.props\n---\n<Fragment set:html={html} />', errors: [unsafe('set:html')]},
    {name: 'set:html shorthand-free expression', code: '<article set:html={post.content} />', errors: [unsafe('set:html')]},
    {name: 'srcdoc', code: '<iframe srcdoc={email.body} />', errors: [srcdoc]},
  ],
})

svelte.run('no-unsafe-html (svelte)', rule, {
  valid: [
    {name: 'sanitized {@html}', code: '{@html DOMPurify.sanitize(html)}'},
    {name: 'constant {@html}', code: '{@html \'<br>\'}'},
    {name: 'sanitized interpolation', code: '{@html `<p>${ sanitizeHtml(html) }</p>`}'},
    {name: 'JSON-LD is left to no-unescaped-script-content', code: '<svelte:head>{@html `<script type="application/ld+json">${ JSON.stringify(data) }</script>`}</svelte:head>'},
    {name: 'text', code: '<p>{html}</p>'},
    {name: 'sandboxed srcdoc', code: '<iframe sandbox {srcdoc}></iframe>'},
    {name: 'innerHTML is an inert attribute in Svelte', code: '<div innerHTML={html}></div>'},
  ],
  invalid: [
    {name: '{@html}', code: '<article>{@html post.body}</article>', errors: [unsafe('{@html}')]},
    {name: '{@html} at the top level', code: '{@html html}', errors: [unsafe('{@html}')]},
    {name: 'interpolated markup', code: '{@html `<p>${ html }</p>`}', errors: [unsafe('{@html}')]},
    {name: 'bind:innerHTML', code: '<div contenteditable bind:innerHTML={html}></div>', errors: [unsafe('innerHTML')]},
    {name: 'shorthand srcdoc', code: '<iframe {srcdoc}></iframe>', errors: [srcdoc]},
    {name: 'opening tag attribute is HTML', code: '{@html `<script nonce="${ nonce }">init()</script>`}', errors: [unsafe('{@html}')]},
  ],
})

html.run('no-unsafe-html (html)', rule, {
  valid: [
    {name: 'static srcdoc is constant', code: '<iframe srcdoc="<p>hi</p>"></iframe>'},
    {name: 'innerHTML attribute is inert', code: '<div innerHTML="<b>x</b>"></div>'},
  ],
  invalid: [],
})
