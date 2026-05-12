const https = require('https');
https.get('https://platzi.com/cursos/ahorro-personal/planificacion-financiera-para-alcanzar-metas-personales/', {headers:{'User-Agent': 'Mozilla/5.0'}}, res => { 
  let data = ''; 
  res.on('data', chunk => data += chunk); 
  res.on('end', () => console.log('dash found:', data.includes('\\"dash\\"'), 'movin found:', data.includes('\\"movin\\"'))); 
});
