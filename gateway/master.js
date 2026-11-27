// Mastering con ffmpeg: loudness uniforme in due passaggi, dissolvenza finale, MP3 a 320 kbps
const { execFile } = require('child_process');

const FFMPEG = 'E:\\MusicAI\\ffmpeg\\bin\\ffmpeg.exe';
const LUFS = -16; // ascolto di sottofondo
const PICCO_DB = -1;
const SFUMATURA_S = 3;

const esegui = (args) => new Promise((resolve, reject) => {
  execFile(FFMPEG, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 600000 }, (e, out, err) => (e ? reject(new Error(`ffmpeg: ${String(err).slice(-300)}`)) : resolve(String(err))));
});
// il riepilogo JSON di loudnorm e' l'ultimo oggetto scritto da ffmpeg
const misura = (testo) => JSON.parse(testo.slice(testo.lastIndexOf('{'), testo.lastIndexOf('}') + 1));

async function master(ingresso, uscita) {
  const info = await esegui(['-hide_banner', '-i', ingresso, '-f', 'null', '-']);
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
  if (!d) throw new Error('durata non leggibile');
  const durata = d[1] * 3600 + d[2] * 60 + Number(d[3]);
  const sfuma = `afade=t=out:st=${Math.max(0, durata - SFUMATURA_S).toFixed(2)}:d=${SFUMATURA_S}`;
  const base = `loudnorm=I=${LUFS}:TP=${PICCO_DB}:LRA=20`;
  const m = misura(await esegui(['-hide_banner', '-i', ingresso, '-af', `${sfuma},${base}:print_format=json`, '-f', 'null', '-']));
  // audio muto: nessuna misura utilizzabile, ci pensa il controllo qualita' a scartarlo
  const misurato = Number.isFinite(Number(m.input_i))
    ? `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : '';
  const r = misura(await esegui(['-hide_banner', '-y', '-i', ingresso, '-af', `${sfuma},${base}${misurato}:print_format=json`, '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', '320k', uscita]));
  return { durata_s: Math.round(durata), lufs: Number(r.output_i), picco_db: Number(r.output_tp) };
}

module.exports = { master, FFMPEG };
