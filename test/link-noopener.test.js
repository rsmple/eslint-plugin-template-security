import rule from '../lib/rules/link-noopener.js'
import {astro, jsx, vue, vueFile} from './testers.js'

const missingRel = (rel = 'noopener') => ({messageId: 'missingRel', data: {rel}})
const incompleteRel = (missing = 'noopener') => ({messageId: 'incompleteRel', data: {missing}})

jsx.run('link-noopener (jsx)', rule, {
  valid: [
    {name: 'noopener', code: '<a href="https://x.com" target="_blank" rel="noopener">x</a>'},
    {name: 'noreferrer implies noopener', code: '<a href="https://x.com" target="_blank" rel="noreferrer">x</a>'},
    {name: 'rel tokens are case-insensitive', code: '<a href="https://x.com" target="_blank" rel="NoOpener">x</a>'},
    {name: 'same-origin link', code: '<a href="/docs" target="_blank">x</a>'},
    {name: 'no target', code: '<a href="https://x.com">x</a>'},
    {name: '_self target', code: '<a href="https://x.com" target="_self">x</a>'},
    {name: 'no href', code: '<a target="_blank">x</a>'},
    {name: 'dynamic rel is trusted', code: '<a href="https://x.com" target="_blank" rel={rel}>x</a>'},
    {name: 'spread may carry rel', code: '<a href={url} target="_blank" {...props}>x</a>'},
    {name: 'unconfigured component', code: '<Button href="https://x.com" target="_blank">x</Button>'},
    {name: 'dynamicLinks off', options: [{dynamicLinks: false}], code: '<a href={url} target="_blank">x</a>'},
  ],
  invalid: [
    {
      name: 'missing rel',
      code: '<a href="https://x.com" target="_blank">x</a>',
      output: '<a href="https://x.com" target="_blank" rel="noopener">x</a>',
      errors: [missingRel()],
    },
    {
      name: 'protocol-relative url',
      code: '<a href="//x.com" target="_blank">x</a>',
      output: '<a href="//x.com" target="_blank" rel="noopener">x</a>',
      errors: [missingRel()],
    },
    {
      name: 'dynamic href is assumed external',
      code: '<a href={url} target="_blank">x</a>',
      output: '<a href={url} target="_blank" rel="noopener">x</a>',
      errors: [missingRel()],
    },
    {
      name: 'dynamic target is assumed to open a window',
      code: '<a href="https://x.com" target={target}>x</a>',
      output: '<a href="https://x.com" target={target} rel="noopener">x</a>',
      errors: [missingRel()],
    },
    {
      name: 'named window target also gets window.opener',
      code: '<a href="https://x.com" target="docs">x</a>',
      output: '<a href="https://x.com" target="docs" rel="noopener">x</a>',
      errors: [missingRel()],
    },
    {
      name: 'rel without noopener keeps its tokens',
      code: '<a href="https://x.com" target="_blank" rel="me nofollow">x</a>',
      output: '<a href="https://x.com" target="_blank" rel="me nofollow noopener">x</a>',
      errors: [incompleteRel()],
    },
    {
      name: 'form',
      code: '<form action="https://x.com/pay" target="_blank" />',
      output: '<form action="https://x.com/pay" target="_blank" rel="noopener" />',
      errors: [missingRel()],
    },
    {
      name: 'configured component',
      options: [{components: {SlideIn: 'href', 'w-button': 'href'}}],
      code: '<><SlideIn href="https://x.com" target="_blank" /><WButton href={url} target="_blank" /></>',
      output: '<><SlideIn href="https://x.com" target="_blank" rel="noopener" /><WButton href={url} target="_blank" rel="noopener" /></>',
      errors: [missingRel(), missingRel()],
    },
    {
      name: 'noreferrer option inserts both',
      options: [{noreferrer: true}],
      code: '<a href="https://x.com" target="_blank">x</a>',
      output: '<a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a>',
      errors: [missingRel('noopener noreferrer')],
    },
    {
      name: 'noreferrer option on a noopener-only rel',
      options: [{noreferrer: true}],
      code: '<a href="https://x.com" target="_blank" rel="noopener">x</a>',
      output: '<a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a>',
      errors: [{messageId: 'missingNoreferrer', data: {missing: 'noreferrer'}}],
    },
  ],
})

vue.run('link-noopener (vue)', rule, {
  valid: [
    {name: 'noopener', code: vueFile('<a href="https://x.com" target="_blank" rel="noopener">x</a>')},
    {name: 'v-bind object may carry rel', code: vueFile('<a :href="url" target="_blank" v-bind="attrs">x</a>')},
  ],
  invalid: [
    {
      name: 'bound href',
      code: vueFile('<a :href="url" target="_blank">x</a>'),
      output: vueFile('<a :href="url" target="_blank" rel="noopener">x</a>'),
      errors: [missingRel()],
    },
    {
      name: 'bound conditional target',
      code: vueFile('<a :href="url" :target="external ? \'_blank\' : undefined">x</a>'),
      output: vueFile('<a :href="url" :target="external ? \'_blank\' : undefined" rel="noopener">x</a>'),
      errors: [missingRel()],
    },
    {
      name: 'bound literal rel is rewritten',
      code: vueFile('<a href="https://x.com" target="_blank" :rel="\'me\'">x</a>'),
      output: vueFile('<a href="https://x.com" target="_blank" rel="me noopener">x</a>'),
      errors: [incompleteRel()],
    },
    {
      name: 'kebab-case component matches a PascalCase option',
      options: [{components: {RouterLink: 'href'}}],
      code: vueFile('<router-link href="https://x.com" target="_blank" />'),
      output: vueFile('<router-link href="https://x.com" target="_blank" rel="noopener" />'),
      errors: [missingRel()],
    },
  ],
})

astro.run('link-noopener (astro)', rule, {
  valid: [
    {name: 'noopener', code: '<a href="https://x.com" target="_blank" rel="noopener">x</a>'},
  ],
  invalid: [
    {
      name: 'shorthand href',
      code: '---\nconst href = "https://x.com"\n---\n<a {href} target="_blank">x</a>',
      output: '---\nconst href = "https://x.com"\n---\n<a {href} target="_blank" rel="noopener">x</a>',
      errors: [missingRel()],
    },
    {
      name: 'rel "me" from a footer social link',
      code: '<a href="https://github.com/x" target="_blank" rel="me">x</a>',
      output: '<a href="https://github.com/x" target="_blank" rel="me noopener">x</a>',
      errors: [incompleteRel()],
    },
  ],
})
