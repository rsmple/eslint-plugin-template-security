import rule from '../lib/rules/no-mixed-content.js'
import {astro, jsx, svelte, vue, vueFile} from './testers.js'

const insecure = (element, attribute) => ({messageId: 'insecure', data: {element, attribute}})

// Every fixable case has one `http:`, and the suggestion rewrites it
const invalid = (name, code, element, attribute) => ({
  name,
  code,
  errors: [{...insecure(element, attribute), suggestions: [{messageId: 'useHttps', output: code.replace(/http:/i, 'https:')}]}],
})

jsx.run('no-mixed-content (jsx)', rule, {
  valid: [
    {name: 'https script', code: '<script src="https://cdn.example.com/a.js" />'},
    {name: 'relative script', code: '<script src="/a.js" />'},
    {name: 'protocol-relative', code: '<script src="//cdn.example.com/a.js" />'},
    {name: 'localhost', code: '<script src="http://localhost:5173/@vite/client" />'},
    {name: 'subdomain of localhost', code: '<iframe src="http://app.localhost/" />'},
    {name: '127.0.0.1', code: '<form action="http://127.0.0.1:8080/submit" />'},
    {name: '[::1]', code: '<script src="http://[::1]/a.js" />'},
    {name: 'localhost in a template head', code: '<script src={`http://localhost:${ port }/a.js`} />'},
    {name: 'images are upgraded by browsers', code: '<img src="http://example.com/a.png" />'},
    {name: 'links navigate, not load', code: '<a href="http://example.com">x</a>'},
    {name: 'canonical link is not fetched', code: '<link rel="canonical" href="http://example.com/" />'},
    {name: 'link without rel', code: '<link href="http://example.com/a.css" />'},
    {name: 'unknown bound src', code: '<script src={url} />'},
    {name: 'https in a template head', code: '<iframe src={`https://${ host }/embed`} />'},
    {name: 'http elsewhere in the URL', code: '<script src="https://example.com/?next=http://x.com" />'},
  ],
  invalid: [
    invalid('script', '<script src="http://cdn.example.com/a.js" />', 'script', 'src'),
    invalid('stylesheet', '<link rel="stylesheet" href="http://fonts.example.com/a.css" />', 'link', 'href'),
    invalid('preload among other rels', '<link rel="preload prefetch" as="script" href="http://x.com/a.js" />', 'link', 'href'),
    invalid('bound rel', '<link rel={rel} href="http://x.com/a.css" />', 'link', 'href'),
    invalid('iframe', '<iframe src="http://maps.example.com/embed" />', 'iframe', 'src'),
    invalid('object', '<object data="http://x.com/a.swf" />', 'object', 'data'),
    invalid('embed', '<embed src="http://x.com/a.pdf" />', 'embed', 'src'),
    invalid('form action', '<form action="http://api.example.com/subscribe" />', 'form', 'action'),
    invalid('button formAction', '<button formAction="http://x.com/pay">Pay</button>', 'button', 'formAction'),
    invalid('Next.js Script', '<Script src="http://x.com/a.js" />', 'Script', 'src'),
    invalid('uppercase scheme and leading space', '<script src=" HTTP://x.com/a.js" />', 'script', 'src'),
    invalid('no slashes', '<script src="http:x.com/a.js" />', 'script', 'src'),
    invalid('template head', '<script src={`http://${ host }/a.js`} />', 'script', 'src'),
    invalid('one conditional branch', '<script src={dev ? \'/a.js\' : \'http://x.com/a.js\'} />', 'script', 'src'),
    invalid('localhost lookalike', '<script src="http://localhost.evil.com/a.js" />', 'script', 'src'),
    {
      name: 'no suggestion with several http: in the attribute',
      code: '<script src={dev ? \'http://a.com/a.js\' : \'http://b.com/a.js\'} />',
      errors: [{...insecure('script', 'src'), suggestions: []}],
    },
  ],
})

vue.run('no-mixed-content (vue)', rule, {
  valid: [
    {name: 'https', code: vueFile('<iframe src="https://x.com" />')},
    {name: 'img', code: vueFile('<img :src="\'http://x.com/a.png\'" />')},
  ],
  invalid: [
    invalid('static iframe', vueFile('<iframe src="http://x.com/embed" />'), 'iframe', 'src'),
    invalid('bound template', vueFile('<form :action="`http://${ host }/submit`" />'), 'form', 'action'),
    invalid('kebab-case attribute', vueFile('<input type="submit" formaction="http://x.com" />'), 'input', 'formaction'),
  ],
})

astro.run('no-mixed-content (astro)', rule, {
  valid: [
    {name: 'https script', code: '<script is:inline src="https://x.com/a.js"></script>'},
  ],
  invalid: [
    invalid('script', '<script is:inline src="http://x.com/a.js"></script>', 'script', 'src'),
    invalid('stylesheet', '<link rel="stylesheet" href="http://x.com/a.css" />', 'link', 'href'),
  ],
})

svelte.run('no-mixed-content (svelte)', rule, {
  valid: [
    {name: 'https in svelte:head', code: '<svelte:head><script src="https://x.com/a.js"></script></svelte:head>'},
  ],
  invalid: [
    invalid('script in svelte:head', '<svelte:head><script src="http://x.com/a.js"></script></svelte:head>', 'script', 'src'),
    invalid('interpolated form action', '<form action="http://{host}/submit"></form>', 'form', 'action'),
  ],
})
