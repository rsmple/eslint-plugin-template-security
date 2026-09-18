import rule from '../lib/rules/no-javascript-url.js'
import {astro, handlebars, html, jsx, svelte, vue, vueFile} from './testers.js'

const jsUrl = attribute => ({messageId: 'javascriptUrl', data: {attribute}})

jsx.run('no-javascript-url (jsx)', rule, {
  valid: [
    {name: 'https', code: '<a href="https://example.com">x</a>'},
    {name: 'dynamic without known prefix', code: '<a href={url}>x</a>'},
    {name: 'javascript in unrelated attribute', code: '<a title="javascript: the good parts">x</a>'},
    {name: 'fragment', code: '<a href="#top">x</a>'},
  ],
  invalid: [
    {name: 'literal', code: '<a href="javascript:void(0)">x</a>', errors: [jsUrl('href')]},
    {name: 'mixed case with leading space', code: '<a href=" JavaScript:alert(1)">x</a>', errors: [jsUrl('href')]},
    {name: 'tab inside the scheme', code: '<a href={"java\\tscript:alert(1)"}>x</a>', errors: [jsUrl('href')]},
    {name: 'template prefix', code: '<a href={`javascript:${ code }`}>x</a>', errors: [jsUrl('href')]},
    {name: 'concatenation prefix', code: '<iframe src={\'javascript:\' + code} />', errors: [jsUrl('src')]},
    {name: 'conditional branch', code: '<a href={ok ? url : \'javascript:;\'}>x</a>', errors: [jsUrl('href')]},
    {name: 'form action', code: '<form action="javascript:submit()" />', errors: [jsUrl('action')]},
    {name: 'svg xlink:href', code: '<svg><a xlink:href="javascript:alert(1)" /></svg>', errors: [jsUrl('xlink:href')]},
    {
      name: 'extra attribute for a component',
      options: [{attributes: ['to']}],
      code: '<Link to="javascript:alert(1)" />',
      errors: [jsUrl('to')],
    },
  ],
})

vue.run('no-javascript-url (vue)', rule, {
  valid: [
    {name: 'bound url', code: vueFile('<a :href="url">x</a>')},
  ],
  invalid: [
    {name: 'static', code: vueFile('<a href="javascript:void(0)">x</a>'), errors: [jsUrl('href')]},
    {name: 'bound literal', code: vueFile('<a :href="\'javascript:void(0)\'">x</a>'), errors: [jsUrl('href')]},
    {name: 'bound concatenation', code: vueFile('<a :href="\'javascript:\' + code">x</a>'), errors: [jsUrl('href')]},
  ],
})

astro.run('no-javascript-url (astro)', rule, {
  valid: [
    {name: 'shorthand', code: '---\nconst href = "/"\n---\n<a {href}>x</a>'},
  ],
  invalid: [
    {name: 'static', code: '<a href="javascript:void(0)">x</a>', errors: [jsUrl('href')]},
    {name: 'template literal attribute', code: '<a href=`javascript:${ code }`>x</a>', errors: [jsUrl('href')]},
  ],
})

svelte.run('no-javascript-url (svelte)', rule, {
  valid: [
    {name: 'relative', code: '<a href="/x">x</a>'},
    {name: 'bound unknown', code: '<a {href}>x</a>'},
  ],
  invalid: [
    {name: 'static', code: '<a href="javascript:void(0)">x</a>', errors: [jsUrl('href')]},
    {name: 'interpolated head', code: '<a href="javascript:{code}">x</a>', errors: [jsUrl('href')]},
    {name: 'bound literal', code: '<iframe src={\'javascript:alert(1)\'} />', errors: [jsUrl('src')]},
  ],
})

html.run('no-javascript-url (html)', rule, {
  valid: [
    {name: 'relative', code: '<a href="/x">x</a>'},
    {name: 'unknown named reference is not decoded', code: '<a href="javascript&foo;alert(1)">x</a>'},
  ],
  invalid: [
    {name: 'static', code: '<a href="javascript:void(0)">x</a>', errors: [jsUrl('href')]},
    {name: 'uppercase', code: '<A HREF="JavaScript:alert(1)">x</A>', errors: [jsUrl('HREF')]},
    {name: 'named reference', code: '<a href="javascript&colon;alert(1)">x</a>', errors: [jsUrl('href')]},
    {name: 'decimal reference without semicolon', code: '<a href="javascript&#58alert(1)">x</a>', errors: [jsUrl('href')]},
    {name: 'hex reference', code: '<a href="&#x6A;avascript:alert(1)">x</a>', errors: [jsUrl('href')]},
    {name: 'encoded tab inside the scheme', code: '<a href="java&Tab;script:alert(1)">x</a>', errors: [jsUrl('href')]},
    {name: 'iframe src', code: '<iframe src="javascript:alert(1)"></iframe>', errors: [jsUrl('src')]},
  ],
})

handlebars.run('no-javascript-url (handlebars)', rule, {
  valid: [
    {name: 'template-filled URL', code: '<a href="{{ url }}">x</a>'},
  ],
  invalid: [
    {name: 'javascript: before a template', code: '<a href="javascript:{{ code }}">x</a>', errors: [jsUrl('href')]},
  ],
})

astro.run('no-javascript-url (astro, character references)', rule, {
  valid: [
    {name: 'bound string is escaped by Astro', code: '<a href={"javascript&colon;alert(1)"}>x</a>'},
  ],
  invalid: [
    {name: 'named reference in a static value', code: '<a href="javascript&colon;alert(1)">x</a>', errors: [jsUrl('href')]},
  ],
})

jsx.run('no-javascript-url (jsx, character references)', rule, {
  valid: [
    {name: 'React sets the string without decoding it', code: '<a href="javascript&colon;alert(1)">x</a>'},
  ],
  invalid: [],
})
