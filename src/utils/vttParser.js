export const parseVtt = (vttContent) => {
  if (!vttContent) return '';

  // Remove WEBVTT header
  let text = vttContent.replace(/^WEBVTT.*\n?/i, '');

  // Remove timestamps like 00:00:01.000 --> 00:00:03.000
  text = text.replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n?/g, '');
  text = text.replace(/\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}\.\d{3}.*\n?/g, '');

  // Remove cue identifiers (numbers alone on a line)
  text = text.replace(/^\d+\s*\n/gm, '');

  // Remove HTML tags sometimes present in VTT (like <b>, <i>, <v Speaker>)
  text = text.replace(/<[^>]+>/g, '');

  // Remove extra blank lines and clean up whitespace
  text = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).join(' ');

  return text;
};
