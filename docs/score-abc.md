# Come si scrive uno score per YuE2

Regole applicate da `src/compositore/abc.js` (scrittura e controllo) e `compositore.js` (musica).
Aggiornato il 27/11/2026.

## Formato (obbligatorio)
Fonte principale: il validatore ufficiale `abc_tools.py` e le guide del repository YuE.

- Intestazione in quest'ordine: `X:1`, `T:` vuoto, `M:4/4`, `L:1/32`, `Q:1/4=bpm`, le due righe `V:` esatte, `K:`.
- Tonalità ammesse: 15 maggiori e 15 minori standard (per esempio `Bb`, `F#m`; non `Dbm`).
- Gruppi di 1-4 battute: blocco `V: Vocal`, poi blocco `V: Ins`, con lo stesso numero di battute.
- Sezioni come commenti: intro, verse, pre-chorus, chorus, bridge, interlude, outro, instrumental.
- Cambi di metro o tonalità: `M:` / `K:` in entrambe le voci, nello stesso punto.
- Durate ammesse: 1 2 3 4 6 8 12 16 24 32 48; le altre con legature. Ogni battuta somma esattamente al metro.
- Pause di battute intere: `Z`, `Z2`..`Z4`; con un accordo si scrive la pausa (`"Bm"z32`).
- Accordi solo in `Vocal`, davanti a un evento: maggiore, m, dim, aug, 7, maj7, m7, dim7, m7b5, sus4, sus2, 6,
  m6, 7sus4, m(maj7), con basso `/X`.
- `Ins` è una sola linea melodica. Niente accordi di note, gruppi irregolari, abbellimenti, ritornelli.
- Alterazioni relative all'armatura, valide fino a fine battuta per tutte le ottave. Le legature uniscono la stessa altezza.
- Strumentali: `Vocal` ha pause e sigle, il tema sta in `Ins`. Nelle lyrics solo i sei tag, senza note.

## Scelte musicali del compositore
Fonti: guide di composizione (motivo, frase, periodo, note dell'accordo) e MeloForm.

- Un tema di due battute per ogni tipo di sezione; frasi di quattro battute: a, b, a in sequenza, cadenza.
- Le riprese si trasformano: sequenza, inversione, ornamento, spostamento ritmico, un grado più su.
- Note dell'accordo sui tempi forti e in cadenza; movimento per grado, salti contenuti.
- Ritornello in registro più alto; intro rarefatta; stop alla fine del bridge; salita verso il ritornello.
- Armonie, scale, celle ritmiche e metro del bridge dipendono dal genere.
- Revisore (0-100) su 30 candidati: accordo sui tempi forti 25, salti 15, ritorno del tema 20, contrasto 15,
  posizione del climax 10, varietà 15.

## Da verificare
- Quanto fedelmente YuE2 segue uno score scritto da regole, in particolare con metri diversi dal 4/4.
- La documentazione non dice cosa rifiuti il motore: l'unico controllo documentato è il validatore.
- Nessuna fonte indica un'estensione melodica consigliata (il compositore usa circa Sol2-Mi5).

## Fonti
- [abc-repair.md](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/instrumental/references/abc-repair.md)
- [abc_tools.py](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/scripts/abc_tools.py)
- [event-schema.md](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/instrumental/references/event-schema.md)
- [LoRA strumentale](https://huggingface.co/Mothersuperior/YuE2-instrumental-cot-full-loras)
- [Standard ABC 2.1](https://abcnotation.com/wiki/abc:standard:v2.1)
- [Motivi e frasi](https://www.dummies.com/article/academics-the-arts/music/music-composition/music-composition-building-melodies-using-motifs-and-phrases-282834/)
- [Tecniche melodiche](https://fiveable.me/fundamentals-of-music-theory/unit-13/melodic-composition-techniques/study-guide/tQNZwjttRET5bvak)
- [MeloForm](https://arxiv.org/pdf/2208.14345)
