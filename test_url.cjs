const https = require('https');
https.get('https://platzi.com/cursos/ahorro-personal/como-armar-mi-plan-de-ahorro/', {headers:{'User-Agent': 'Mozilla/5.0'}}, res => { 
  let data = ''; 
  res.on('data', chunk => data += chunk); 
  res.on('end', () => {
    console.log('index of dash:', data.indexOf('\\"dash\\"'));
    console.log('index of movin:', data.indexOf('\\"movin\\"'));
  }); 
});