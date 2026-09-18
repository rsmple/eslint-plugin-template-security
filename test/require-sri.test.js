import rule from '../lib/rules/require-sri.js'
import {astro, html, jsx, svelte, vue, vueFile} from './testers.js'

const missingIntegrity = element => ({messageId: 'missingIntegrity', data: {element}})
const missingCrossorigin = element => ({messageId: 'missingCrossorigin', data: {element}})

const HASH = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC'

jsx.run('require-sri (jsx)', rule, {
  valid: [
    {name: 'integrity and crossOrigin', code: `<script src="https://cdn.example.com/a.js" integrity="${ HASH }" crossOrigin="anonymous" />`},
    {name: 'stylesheet with both', code: `<link rel="stylesheet" href="https://cdn.example.com/a.css" integrity="${ HASH }" crossorigin />`},
    {name: 'same-origin script', code: '<script src="/assets/a.js" />'},
    {name: 'relative script', code: '<script src="a.js" />'},
    {name: 'inline script', code: '<script>{"console.log(1)"}</script>'},
    {name: 'unknown bound src', code: '<script src={url} />'},
    {name: 'template without a known host', code: '<script src={`${ base }/a.js`} />'},
    {name: 'link that does not load a resource', code: '<link rel="preconnect" href="https://fonts.gstatic.com" />'},
    {name: 'icon ignores integrity', code: '<link rel="icon" href="https://cdn.example.com/favicon.ico" />'},
    {name: 'bound integrity is trusted', code: '<script src="https://cdn.example.com/a.js" integrity={hash} crossOrigin="anonymous" />'},
    {name: 'spread may carry integrity', code: '<script src="https://cdn.example.com/a.js" {...props} />'},
    {
      name: 'trusted host',
      options: [{trustedHosts: ['www.googletagmanager.com']}],
      code: '<script src="https://www.googletagmanager.com/gtag/js?id=G-1" />',
    },
    {
      name: 'trusted wildcard host',
      options: [{trustedHosts: ['*.stripe.com']}],
      code: '<script src="https://js.stripe.com/v3/" />',
    },
    {
      name: 'host with a port',
      options: [{trustedHosts: ['cdn.example.com']}],
      code: '<script src="https://cdn.example.com:8443/a.js" />',
    },
  ],
  invalid: [
    {name: 'cdn script', code: '<script src="https://cdn.jsdelivr.net/npm/x@1/dist/x.min.js" />', errors: [missingIntegrity('script')]},
    {name: 'protocol-relative', code: '<script src="//cdn.example.com/a.js" />', errors: [missingIntegrity('script')]},
    {name: 'http', code: '<script src="http://cdn.example.com/a.js" />', errors: [missingIntegrity('script')]},
    {name: 'stylesheet', code: '<link rel="stylesheet" href="https://cdn.example.com/a.css" />', errors: [missingIntegrity('link')]},
    {name: 'modulepreload', code: '<link rel="modulepreload" href="https://cdn.example.com/a.js" />', errors: [missingIntegrity('link')]},
    {name: 'bound rel', code: '<link rel={rel} href="https://cdn.example.com/a.css" />', errors: [missingIntegrity('link')]},
    {name: 'Next.js Script', code: '<Script src="https://cdn.example.com/a.js" />', errors: [missingIntegrity('Script')]},
    {name: 'template with a known host', code: '<script src={`https://cdn.example.com/x@${ version }/x.js`} />', errors: [missingIntegrity('script')]},
    {name: 'one cross-origin branch', code: '<script src={dev ? \'/a.js\' : \'https://cdn.example.com/a.js\'} />', errors: [missingIntegrity('script')]},
    {name: 'integrity without crossOrigin', code: `<script src="https://cdn.example.com/a.js" integrity="${ HASH }" />`, errors: [missingCrossorigin('script')]},
    {
      name: 'subdomain wildcard does not match the apex',
      options: [{trustedHosts: ['*.stripe.com']}],
      code: '<script src="https://stripe.com/a.js" />',
      errors: [missingIntegrity('script')],
    },
    {
      name: 'trusted host is exact',
      options: [{trustedHosts: ['example.com']}],
      code: '<script src="https://cdn.example.com/a.js" />',
      errors: [missingIntegrity('script')],
    },
  ],
})

vue.run('require-sri (vue)', rule, {
  valid: [
    {name: 'both attributes', code: vueFile(`<link rel="stylesheet" href="https://cdn.example.com/a.css" integrity="${ HASH }" crossorigin="anonymous" />`)},
    {name: 'v-bind object may carry integrity', code: vueFile('<link rel="stylesheet" href="https://cdn.example.com/a.css" v-bind="attrs" />')},
  ],
  invalid: [
    {name: 'stylesheet', code: vueFile('<link rel="stylesheet" href="https://cdn.example.com/a.css" />'), errors: [missingIntegrity('link')]},
    {name: 'bound href', code: vueFile('<link rel="stylesheet" :href="`https://cdn.example.com/${ theme }.css`" />'), errors: [missingIntegrity('link')]},
    {name: 'no crossorigin', code: vueFile(`<link rel="stylesheet" href="https://cdn.example.com/a.css" integrity="${ HASH }" />`), errors: [missingCrossorigin('link')]},
  ],
})

astro.run('require-sri (astro)', rule, {
  valid: [
    {name: 'bundled script', code: '<script src="../scripts/a.ts"></script>'},
    {name: 'both attributes', code: `<script is:inline src="https://cdn.example.com/a.js" integrity="${ HASH }" crossorigin="anonymous"></script>`},
  ],
  invalid: [
    {name: 'cdn script', code: '<script is:inline src="https://cdn.example.com/a.js"></script>', errors: [missingIntegrity('script')]},
  ],
})

svelte.run('require-sri (svelte)', rule, {
  valid: [
    {name: 'both attributes', code: `<svelte:head><link rel="stylesheet" href="https://cdn.example.com/a.css" integrity="${ HASH }" crossorigin="anonymous" /></svelte:head>`},
    {name: 'same-origin', code: '<svelte:head><script src="/a.js"></script></svelte:head>'},
  ],
  invalid: [
    {name: 'cdn stylesheet', code: '<svelte:head><link rel="stylesheet" href="https://cdn.example.com/a.css" /></svelte:head>', errors: [missingIntegrity('link')]},
    {name: 'interpolated cdn script', code: '<svelte:head><script src="https://cdn.example.com/x@{version}/x.js"></script></svelte:head>', errors: [missingIntegrity('script')]},
  ],
})

html.run('require-sri (html)', rule, {
  valid: [
    {name: 'both attributes', code: `<script src="https://cdn.example.com/a.js" integrity="${ HASH }" crossorigin="anonymous"></script>`},
    {name: 'same-origin', code: '<script type="module" src="/src/main.ts"></script>'},
  ],
  invalid: [
    {name: 'cdn script', code: '<script src="https://cdn.jsdelivr.net/npm/x@1"></script>', errors: [missingIntegrity('script')]},
    {name: 'cdn stylesheet', code: '<link rel="stylesheet" href="https://unpkg.com/x@1/x.css">', errors: [missingIntegrity('link')]},
    {name: 'no crossorigin', code: `<script src="https://cdn.example.com/a.js" integrity="${ HASH }"></script>`, errors: [missingCrossorigin('script')]},
  ],
})
