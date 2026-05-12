const https = require('https');
https.get('https://platzi.com/cursos/ahorro-personal/como-armar-mi-plan-de-ahorro/', {headers:{'User-Agent': 'Mozilla/5.0'}}, res => { 
  let data = ''; 
  res.on('data', chunk => data += chunk); 
  res.on('end', () => {
    console.log('dash found:', data.includes('\\"dash\\"'));
    console.log('movin found:', data.includes('\\"movin\\"'));
    const materialTypeMatches = data.match(/"material_type":"([a-z0-9_]+)"/gi) || [];
    console.log('material_type:', materialTypeMatches);
    const materialTypeMatches2 = data.match(/\\"material_type\\":\\"([a-z0-9_]+)\\"/gi) || [];
    console.log('escaped material_type:', materialTypeMatches2);
  }); 
});