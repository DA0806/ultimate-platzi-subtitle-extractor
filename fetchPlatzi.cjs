const https = require('https');
const fs = require('fs');

https.get('https://platzi.com/cursos/programacion-basica/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('platzi_course.html', data);
    console.log('Saved to platzi_course.html');
  });
});
