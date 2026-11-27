// Scrive in config/catalogo.json il campo "copertina" di ogni genere. Rilanciabile: sovrascrive solo quel campo.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'config', 'catalogo.json');
// genere: [etichetta, font, corsivo, prompt]
const S = {
  'Meditazione': ['Meditazione', 'Georgia', 0, 'single bronze tibetan singing bowl with wooden mallet on a flat stone, wide open rim, misty mountain lake at blue hour, soft golden light, serene minimal composition, fine art photography, muted indigo and gold'],
  'Pranayama-respiro': ['Pranayama', 'Georgia', 0, 'soft swirling breath-like mist over a calm sea at dawn, a single white feather floating, airy minimal fine art photography, pale teal and cream'],
  'Yin-Savasana': ['Yin & Savasana', 'Georgia', 0, 'deep night sky over still dark water, one faint violet moon, velvet shadows, heavy calm, atmospheric painting, deep purple and black'],
  'Restorative': ['Restorative', 'Georgia', 1, 'warm linen blanket and cushions beside a window with soft afternoon light, dried flowers, cozy still life photography, sand and terracotta'],
  'Sound-bath-rilassamento': ['Sound bath', 'Georgia', 0, 'large hanging bronze gong and translucent crystal singing bowls, concentric light ripples, ethereal glow, violet and lavender, fine art photography'],
  'Hatha-base': ['Hatha', 'Georgia', 0, 'empty wooden yoga deck facing a green valley in morning light, bamboo and ferns, tranquil nature photography, sage green and ivory'],
  'Vinyasa-dinamico': ['Vinyasa', 'Segoe UI', 0, 'flowing silk ribbons in motion across a sunset desert, dynamic curves, vivid orange and amber, painterly illustration'],
  'Power-yoga': ['Power yoga', 'Impact', 0, 'powerful ocean wave breaking against black rock, electric teal and coral light, high energy photography, sharp contrast'],
  'Funk-groove': ['Funk', 'Impact', 0, '1970s funk record sleeve, glowing electric bass guitar and vinyl, concentric retro stripes, mustard orange and brown, screen print poster'],
  'Afro-latin-groove': ['Afro-latin', 'Segoe UI', 0, 'conga hand drums on a sunlit street with bold woven textile patterns, vibrant festive gouache illustration, red yellow and turquoise'],
  'Trip-hop-dolce': ['Trip-hop', 'Bahnschrift', 0, 'rainy city window at night with blurred neon reflections, vintage electric piano silhouette, grainy film photography, muted blue and amber'],
  'Reggae-dub-morbido': ['Reggae dub', 'Impact', 0, 'stack of vintage wooden sound system speakers on a tropical beach at sunset, palm leaves, warm green gold and red, retro poster illustration'],
  'Jazz-lounge': ['Jazz lounge', 'Georgia', 1, 'upright double bass and grand piano in a dim smoky lounge, warm table lamp, cinematic photography, deep burgundy and brass'],
  'Folk-strumming': ['Folk', 'Georgia', 0, 'acoustic guitar and banjo leaning on a wooden cabin porch, golden wheat fields, warm vintage illustration, ochre and green'],
  'Surf-rock-strumentale': ['Surf rock', 'Impact', 0, 'giant curling turquoise wave with a vintage surfboard and woodie car on the beach, 1960s screen print poster, teal cream and coral'],
  'Post-rock-strumentale': ['Post-rock', 'Bahnschrift', 0, 'lone radio tower on a vast foggy plain under an immense storm lit sky, cinematic wide landscape photography, slate blue and pale gold'],
  'Blues-shuffle-strumentale': ['Blues', 'Georgia', 1, 'resonator slide guitar on a chair at a delta crossroads at dusk, old gas station light, textured oil painting, indigo and rust'],
  'Indie-rock-strumentale': ['Indie rock', 'Segoe UI', 0, 'vintage guitar amplifier and instant photo prints on a bedroom floor in sunlight, faded film photography, pastel yellow and sky blue'],
  'Rockabilly-strumentale': ['Rockabilly', 'Impact', 0, '1950s red convertible car in front of a neon diner with a hollow body guitar, retro americana illustration, cherry red and mint'],
  'Techno-minimale': ['Techno minimale', 'Bahnschrift', 0, 'minimal geometric composition of repeating light bars in a dark concrete tunnel, stark abstract, monochrome with a single cyan accent'],
  'Piano-minimalista': ['Piano minimalista', 'Georgia', 0, 'close view of piano keys fading into white fog, one falling leaf, elegant minimal black and white fine art photography'],
  'Score-cinematico': ['Cinematico', 'Georgia', 0, 'epic mountain citadel above a sea of clouds with dramatic sun rays, cinematic matte painting, deep blue and gold'],
  'Folk-balcanico': ['Folk balcanico', 'Georgia', 0, 'accordion and clarinet in a festive village square with strings of lights and embroidered ribbons, lively folk art painting, red and ochre'],
  'Beat-hip-hop': ['Hip-hop', 'Impact', 0, 'vintage sampler and turntable on a brick rooftop at golden hour, graffiti color shapes, urban illustration, purple and orange'],
  'Manouche-swing': ['Manouche swing', 'Georgia', 1, 'gypsy jazz guitar and violin beside a painted wooden caravan with a campfire, 1930s paris poster illustration, wine red and cream'],
  'Synthwave': ['Synthwave', 'Bahnschrift', 1, 'retrowave, giant sunset sun cut by horizontal stripes, glowing magenta perspective grid floor to the horizon, wireframe mountains, retro sports car, 1980s airbrush illustration, magenta and cyan'],
  'Flamenco-chitarra': ['Flamenco', 'Georgia', 1, 'spanish guitar with swirling red ruffled fabric around it, andalusian arches, passionate oil painting, crimson and black'],
  'Celtic-arpa-whistle': ['Celtic', 'Georgia', 0, 'carved celtic harp on a green cliff above a misty sea, standing stones, storybook painting, emerald and silver'],
  'Drum-and-bass-soft': ['Drum and bass', 'Bahnschrift', 1, 'streaks of fast light trails over a futuristic night city seen from above, fluid motion blur, electric blue and lime'],
  'Gamelan-ambient': ['Gamelan', 'Georgia', 0, 'ornate bronze gamelan metallophones in a balinese temple courtyard with incense haze, soft golden fine art photography, bronze and jade'],
  'Bossa-nova-chitarra': ['Bossa nova', 'Georgia', 1, 'vintage 1960s record sleeve, classical nylon guitar standing alone against a Rio de Janeiro balcony railing, sugarloaf mountain, warm sunset, flat gouache shapes, teal and orange'],
  'Vocalise-coro': ['Vocalise', 'Georgia', 1, 'luminous soundwaves rising through a tall gothic cloister with soft light beams, ethereal painting, pearl and rose'],
  'Overtone-canto': ['Overtone', 'Georgia', 0, 'concentric golden resonance rings over an endless steppe at twilight, mystical minimal painting, copper and deep blue'],
  'Canto-gregoriano-moderno': ['Canto monodico', 'Georgia', 0, 'candlelit romanesque abbey nave with stone arches and a single shaft of light, reverent chiaroscuro painting, amber and shadow'],
  'Soul-vocalise': ['Soul', 'Georgia', 1, 'vintage chrome microphone under a warm spotlight with velvet curtain, 1960s soul record sleeve, plum and gold'],
  'Metal-strumentale': ['Metal', 'Impact', 0, 'huge black wrought iron gate standing in the foreground on a volcanic cliff, lightning storm, molten lava, heavy metal album oil painting, black and blood red, high contrast'],
  'Industrial-techno': ['Industrial techno', 'Impact', 0, 'colossal rusted factory machinery with sparks and red warning light, brutalist industrial photography, steel grey and red'],
  'Trap-strumentale': ['Trap', 'Impact', 0, 'black luxury car under violet neon in an empty night parking garage with low fog, moody photography, violet and black'],
  'Hard-rock-strumentale': ['Hard rock', 'Impact', 0, 'electric guitar planted in cracked desert ground with flames and a burning sunset sky, 1970s rock album painting, orange and charcoal'],
};
const cat = JSON.parse(fs.readFileSync(FILE, 'utf8'));
for (const c of cat.categories) {
  const s = S[c.name];
  if (s) c.copertina = { etichetta: s[0], prompt: s[3], font: s[1], corsivo: !!s[2] };
  else console.warn('senza descrizione (usera il ripiego):', c.name);
}
fs.writeFileSync(FILE, JSON.stringify(cat, null, 2));
console.log('copertine descritte:', cat.categories.filter((c) => c.copertina).length, 'su', cat.categories.length);
