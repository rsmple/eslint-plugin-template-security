import rule from '../lib/rules/no-html-with-children.js'
import {astro, jsx, vue, vueFile} from './testers.js'

const withChildren = sink => ({messageId: 'htmlWithChildren', data: {sink}})

jsx.run('no-html-with-children (jsx)', rule, {
  valid: [
    {name: 'self-closing', code: '<div dangerouslySetInnerHTML={{__html: html}} />'},
    {name: 'empty', code: '<div innerHTML={html}></div>'},
    {name: 'whitespace only', code: '<div innerHTML={html}>\n  \n</div>'},
    {name: 'comment only', code: '<div innerHTML={html}>{/* filled by innerHTML */}</div>'},
    {name: 'children without a sink', code: '<div className="x"><p>text</p></div>'},
    {name: 'children prop without a sink', code: '<Card children={body} />'},
  ],
  invalid: [
    {name: 'text child (React)', code: '<div dangerouslySetInnerHTML={{__html: html}}>fallback</div>', errors: [withChildren('dangerouslySetInnerHTML')]},
    {name: 'element child (Solid)', code: '<div innerHTML={html}><p>child</p></div>', errors: [withChildren('innerHTML')]},
    {name: 'expression child', code: '<div innerHTML={html}>{text}</div>', errors: [withChildren('innerHTML')]},
    {name: 'fragment child', code: '<div innerHTML={html}><>x</></div>', errors: [withChildren('innerHTML')]},
    {name: 'children prop', code: '<div dangerouslySetInnerHTML={{__html: html}} children={text} />', errors: [withChildren('dangerouslySetInnerHTML')]},
    {name: 'sanitized is still overwritten', code: '<div innerHTML={DOMPurify.sanitize(html)}>x</div>', errors: [withChildren('innerHTML')]},
    {name: 'constant is still overwritten', code: '<div innerHTML="<b>x</b>">x</div>', errors: [withChildren('innerHTML')]},
  ],
})

vue.run('no-html-with-children (vue)', rule, {
  valid: [
    {name: 'self-closing', code: vueFile('<div v-html="html" />')},
    {name: 'whitespace and comments', code: vueFile('<div v-html="html">\n  <!-- rendered from markdown -->\n</div>')},
  ],
  invalid: [
    {name: 'v-html with text', code: vueFile('<div v-html="html">Loading…</div>'), errors: [withChildren('v-html')]},
    {name: 'v-html with interpolation', code: vueFile('<div v-html="html">{{ fallback }}</div>'), errors: [withChildren('v-html')]},
    {name: ':innerHTML with an element', code: vueFile('<div :innerHTML="html"><span /></div>'), errors: [withChildren('innerHTML')]},
  ],
})

astro.run('no-html-with-children (astro)', rule, {
  valid: [
    {name: 'self-closing', code: '<article set:html={html} />'},
    {name: 'whitespace and comments', code: '<article set:html={html}>\n  <!-- from the CMS -->\n</article>'},
  ],
  invalid: [
    {name: 'set:html with children', code: '<article set:html={html}>\n  <p>Fallback</p>\n</article>', errors: [withChildren('set:html')]},
    {name: 'set:html with an expression', code: '<Fragment set:html={html}>{fallback}</Fragment>', errors: [withChildren('set:html')]},
  ],
})
