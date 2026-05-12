const fs = require('fs');
const html = '{"source": "https:\\/\\/static.platzi.com\\/media\\/subtitle\\/file-es.vtt"} regular http://test.com/es.vtt ';

const matches = html.match(/https?:[^\s"']+\.vtt/g) || [];
const cleaned = matches.map(url => url.replace(/\\\//g, '/'));
console.log(cleaned);
