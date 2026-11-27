// Due score scritti a mano per le prove sul motore (circa 120 s ciascuno).
// Notazione: "E5:8" = Mi quinta ottava per 8/32, "r:4" = pausa, "~" finale = legata alla successiva.
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const note = (testo) => testo.split(/\s+/).map((t) => {
  const m = /^(?:r|([A-G])([#b]?)(\d)):(\d+)(~?)$/.exec(t);
  if (!m) throw new Error(`nota non valida: ${t}`);
  const [, l, alt, ott, durata, lega] = m;
  const midi = l ? 12 * (Number(ott) + 1) + BASE[l] + (alt === '#' ? 1 : alt === 'b' ? -1 : 0) : null;
  return { midi, durata: Number(durata), ...(lega ? { lega: true } : {}) };
});

// Battute di una sezione: accordi ciclici (una stringa "C B7" = due accordi nella battuta), tema ciclico (null = pausa)
function sezione(nome, quante, accordi, tema, extra = {}) {
  const lunghezza = { '3/4': 24, '7/8': 28 }[extra.metro] || 32;
  const battute = Array.from({ length: quante }, (_, i) => {
    const sigle = accordi[i % accordi.length].split(' ');
    const t = tema[i % tema.length];
    return { accordi: sigle.map((sigla, j) => ({ pos: (j * lunghezza) / sigle.length, sigla })), vocal: null, ins: t ? note(t) : null };
  });
  return { nome, ...extra, battute };
}

// ---- Surf rock, Mi minore, 136 bpm: 68 battute ----
const riff = ['E3:4 E3:4 G3:4 E3:4 A3:4 E3:4 B3:4 G3:4', 'E3:4 E3:4 G3:4 E3:4 D4:4 B3:4 A3:4 G3:4'];
const temaA = [
  'E5:4 E5:2 E5:2 G5:4 B5:8 A5:4 G5:4 F#5:4',
  'E5:8 C5:4 E5:4 G5:12 r:4',
  'F#5:4 F#5:2 F#5:2 A5:4 B5:8 A5:4 F#5:4 D#5:4',
  'E5:8 C5:4 B4:4 A4:12 r:4',
];
const rispostaA = [temaA[0], 'E5:4 G5:4 C6:8 B5:4 G5:4 E5:8', temaA[2], 'C5:4 B4:4 A4:4 B4:4 E5:16'];
// sequenza: lo stesso disegno una terza sopra, con chiusa ornata
const temaVariato = [
  'G5:4 G5:2 G5:2 B5:4 D6:8 C6:4 B5:4 A5:4',
  'G5:6 E5:2 G5:4 C6:4 E6:12 r:4',
  'A5:4 A5:2 A5:2 B5:4 D#6:8 B5:4 A5:4 F#5:4',
  'G5:2 F#5:2 E5:4 C5:4 B4:4 E5:12 r:4',
];
const ritornello = ['B5:12 G5:4 E5:16', 'C6:12 G5:4 E5:16', 'B5:8 A5:8 F#5:8 D#5:8', 'E5:16~ E5:8 r:8'];
const stop = ['E5:4 r:12 B4:4 r:12', 'C5:4 r:12 G4:4 r:12', 'B4:4 r:12 F#4:4 r:12', 'B4:2 C5:2 D#5:2 E5:2 F#5:2 G5:2 A5:2 B5:2 B5:16'];

const surf = {
  bpm: 136, metro: '4/4', tonalita: 'Em',
  sezioni: [
    sezione('intro', 8, ['Em', 'Em', 'C', 'B7'], [null, null, null, null, riff[0], riff[1], riff[0], riff[1]]),
    sezione('verse', 16, ['Em', 'C', 'B7', 'Am7'], [...temaA, ...rispostaA]),
    sezione('chorus', 8, ['Em', 'C', 'B7', 'Em'], ritornello),
    sezione('verse', 16, ['Em', 'C', 'B7', 'Am7'], [...temaVariato, ...rispostaA]),
    sezione('bridge', 4, ['Em', 'C', 'B7', 'B7'], stop),
    sezione('chorus', 8, ['Em', 'C', 'B7', 'Em'], ritornello),
    sezione('outro', 8, ['Em', 'C', 'B7', 'Em'], [temaA[0], temaA[1], temaA[2], 'E5:16 r:16', riff[0], riff[1], 'E5:32~', 'E5:16 r:16']),
  ],
};

// ---- Cinematico, Re minore, 92 bpm: 3/4, 4/4, 7/8, ripresa in Fa, climax ----
const tema = ['D5:12 A5:4 F5:12 E5:4', 'D5:8 F5:8 Bb5:16', 'Bb5:12 A5:4 G5:12 D5:4', 'E5:8 C#5:8 A4:16'];
const temaOrnato = [tema[0], 'D5:4 E5:4 F5:8 Bb5:12 C6:4', tema[2], 'E5:4 F5:4 G5:4 E5:4 C#5:16'];
// aggravamento: le prime due battute del tema in valori doppi, trasportate in Fa
const temaLargo = ['F5:24 C6:8', 'A5:24 G5:8', 'F5:16 A5:16', 'D6:32'];
const ostinato = ['D4:4 A4:4 D5:4 A4:4 F4:4 A4:4 E4:4', 'D4:4 Bb4:4 D5:4 Bb4:4 F4:4 Bb4:4 A4:4'];
const ostinatoLa = 'C#4:4 A4:4 C#5:4 A4:4 E4:4 A4:4 G4:4';
const climax = ['D6:12 A6:4 F6:12 E6:4', 'D6:8 F6:8 Bb6:16', 'Bb6:12 A6:4 G6:8 F6:4 E6:4', 'E6:4 F6:4 E6:4 C#6:4 A5:16'];

const cinematico = {
  bpm: 92, metro: '4/4', tonalita: 'Dm',
  sezioni: [
    sezione('intro', 8, ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'Asus4', 'A7'],
      [null, null, 'D4:24~', 'D4:24', 'G4:16 A4:8', 'Bb4:24', 'D5:24', 'C#5:24'], { metro: '3/4' }),
    sezione('verse', 12, ['Dm', 'Bb', 'Gm', 'A7'], [...tema, ...temaOrnato, ...tema]),
    sezione('interlude', 8, ['Dm', 'Bbmaj7', 'Gm7', 'A7'], [...ostinato, ostinato[0], ostinatoLa], { metro: '7/8' }),
    sezione('verse', 8, ['F', 'Dm7', 'Bbmaj7', 'Bb C7'], temaLargo, { tonalita: 'F' }),
    sezione('chorus', 8, ['Dm', 'Bb', 'Gm', 'A7'], climax),
    sezione('outro', 5, ['Dm', 'Bb', 'Gm', 'Asus4', 'Dm'], ['D5:12 A5:4 r:16', 'r:16 F5:12 E5:4', 'D5:32', 'E5:32', 'D5:24 r:8']),
  ],
};

module.exports = { surf, cinematico };
