/**
 * Mnemonics for the kana.
 *
 * ## Why these live on the client
 *
 * Same reasoning as `romaji.ts`: the data is display, the rule is a display
 * rule, and the server stays the source of truth for what a character *is*
 * rather than for how to remember it. A mnemonic is also the one piece of this
 * course that is unashamedly a crutch — it exists to be discarded once the
 * character is known, so it must never sit in the exercise payload.
 *
 * ## They are authored, not generated
 *
 * Every one of these hangs the *shape* of the glyph off the *sound* it makes,
 * because a mnemonic that only tells a story about the shape ("it looks like a
 * bird") gives you nothing to recall the reading from. The pattern throughout
 * is: an English word that starts with the romaji, attached to a picture the
 * stroke shape actually supports.
 *
 * Where the shape genuinely offers nothing — a few of the plainer katakana —
 * the hook is the contrast with its hiragana partner instead, which is the
 * thing a learner actually confuses it with.
 *
 * ## Only the base sets
 *
 * Dakuten (が, ざ), handakuten (ぱ) and yōon (きゃ) are deliberately absent.
 * They are the base character plus a mark, and that is exactly how they are
 * taught — the diacritic is the rule to learn, not a new shape. `mnemonicFor`
 * strips the mark and returns the base character's hook, so が shows き's
 * picture, which is the association that helps.
 */

/** The mark stripped from が to reach か. Combining voiced/semi-voiced marks. */
const DAKUTEN = /[゙゚゛゜]/g;

/**
 * Voiced kana are single codepoints, not base + combining mark, so a regex
 * cannot strip them. Normalising to NFD splits them apart, and after that the
 * combining mark can go.
 */
function baseKana(char: string): string {
  return char.normalize('NFD').replace(DAKUTEN, '').normalize('NFC');
}

const HIRAGANA: Record<string, string> = {
  あ: 'An **a**ntenna on top of a capital A, leaning over.',
  い: 'Two **ee**ls swimming side by side — the short one and the long one.',
  う: 'A person bowing low, saying **oo**h.',
  え: 'An **e**xotic bird with a long neck and a fan of tail feathers.',
  お: 'Like あ, but this one is throwing a ball — **oh**, it flew off.',
  か: 'A **ka**te on a string, with the crossbar of the frame showing.',
  き: 'A **key** on a keyring, teeth pointing left.',
  く: 'A bird’s beak opening — the **cuc**koo.',
  け: 'A **ke**g on its side with a tap sticking out of the left.',
  こ: 'Two **co**ins lying flat, one above the other.',
  さ: 'A **sa**lmon curving upstream, fin at the top.',
  し: 'A fishing hook dangling — **she** is fishing.',
  す: 'A corkscrew going down into a cork — **Sue**’s wine.',
  せ: 'A mouth with a tongue out, **se**t to say “seh”.',
  そ: 'A zigzag stitch — **so**wing thread back and forth.',
  た: 'A **ta**ll cross with a smaller mark tucked in beside it.',
  ち: 'A **chee**rful chin and a smile, facing left.',
  つ: 'A **tsu**nami wave curling over.',
  て: 'A **te**lephone pole with the wire hanging off it.',
  と: 'A **to**e with a thorn stuck into it.',
  な: 'A **na**il hammered into a plank, bent over at the end.',
  に: 'Two **knee**s side by side, seen from the front.',
  ぬ: 'A bowl of **noo**dles with a loop of noodle hanging off.',
  ね: 'A cat’s tail curling into a loop — **neh**, says the cat.',
  の: 'A **no** sign — a circle with a line straight through it.',
  は: 'A capital H with a **ha**t — the top of the H pokes up.',
  ひ: 'A wide grin — the smile that goes with a **hee** sound.',
  ふ: 'A **hoo**ded figure hunched over, seen from the side.',
  へ: 'A gentle **hey** of a hill — a slope up and a slope down.',
  ほ: 'は with an extra bar: the **ho**tel sign has an extra floor.',
  ま: 'A **ma**st with two crossbars and a rope loop at the bottom.',
  み: 'The number 21 tangled up — and **mi** is 3, which is 2 plus 1.',
  む: 'A **moo**ing cow with a curl of horn and a flick of tail.',
  // め *is* the word for eye (目, me), so the picture and the reading are the
  // same fact — the strongest hook in the set.
  め: 'Like ぬ but with no loop — an eye with a lash. **Me** is the word for eye.',
  も: 'A fish**mo**nger’s hook with two fish hung across it.',
  や: 'A **ya**cht heeling over, sail to the left.',
  ゆ: 'A **u**nique fish with a loop of a body and a fin.',
  よ: 'A **yo**-yo hanging on its string, wound round the middle.',
  ら: 'A **ra**bbit sitting up, ears back, tail behind.',
  り: 'Two **ree**ds standing in water, the taller one on the right.',
  る: 'A winding **rou**te that ends in a loop.',
  れ: 'Like る but the loop is unwound — a **re**laxed leg kicking out.',
  ろ: 'The same **ro**ad as る, but with no loop at the end.',
  わ: 'Like れ, but the tail curls in — **wa**ter swirling down a drain.',
  を: 'A person kicking a ball on their knee — **o**ver it goes.',
  ん: 'A lazy **n**, written in one stroke without lifting the pen.',
};

const KATAKANA: Record<string, string> = {
  ア: 'An **a**xe head, blade to the left, handle down.',
  イ: 'An **ea**sel with one leg — simpler than hiragana い.',
  ウ: 'A roof with a chimney — **oo**, someone is home.',
  エ: 'An **e**ngineer’s girder, an I-beam seen end on.',
  オ: 'A tree with a branch crossing it — **oh**, it fell over.',
  カ: 'Same **ka**te as か, but the string has been cut away.',
  キ: 'The same **key** as き, with the ring snapped off.',
  ク: 'A **cu**t of cheese, wedge-shaped, with a slice off the top.',
  ケ: 'A **ke**ttle handle, tilted.',
  コ: 'Two **co**rners of a box — the top and the left side.',
  サ: 'The same **sa**lmon as さ, cut into three by the net.',
  シ: 'Two eyes and a **she**epish grin, tipped on its side.',
  ス: 'A **soup** spoon leaning against the bowl.',
  セ: 'The same mouth as せ, with the tongue **se**t straight.',
  ソ: 'One eye and a nose, **so** it is シ with a stroke missing.',
  タ: 'A **ta**il with a slash through it — ク with an extra stroke.',
  チ: 'The same **chee**rful chin as ち, straightened out.',
  ツ: 'Three drops of a **tsu**nami falling — シ stood upright.',
  テ: 'The **te**lephone pole again, but with two crossbars.',
  ト: 'A **to**tem pole with one peg sticking out to the right.',
  ナ: 'The same **na**il as な, before it was bent.',
  ニ: 'Two lines, and **ni** is the number two.',
  ヌ: 'The **noo**dles from ぬ, tipped out of the bowl.',
  ネ: 'The cat again, but sharper — **neh**, with a pointed ear.',
  ノ: 'A single stroke going down — a **no**se, and nothing else.',
  ハ: 'Two legs apart, **ha** ha, someone laughing.',
  ヒ: 'A **hee**l with the foot flat on the ground.',
  フ: 'The **hoo**d from ふ with the person gone — just the hood.',
  ヘ: 'Identical to hiragana へ — the same **hey** of a hill.',
  ホ: 'The tree オ with two extra roots — a **ho**tel’s foundations.',
  マ: 'A **ma**rquee roof coming to a point, with a pole under it.',
  ミ: 'Three lines, and **mi** is the number three.',
  ム: 'A **moo**ing cow’s mouth, open and square.',
  メ: 'Crossed swords — **me**t in a duel.',
  モ: 'The fish**mo**nger’s hook from も, straightened.',
  ヤ: 'The **ya**cht from や with the sail simplified to one stroke.',
  ユ: 'A **u**-turn drawn square, going right then down.',
  ヨ: 'Three prongs of a fork — a **yo**-yo would catch on them.',
  ラ: 'A **ra**bbit’s ears and back, with the body left off.',
  リ: 'The same two **ree**ds as り, cut straight.',
  ル: 'Two legs **ru**nning, one kicking further than the other.',
  レ: 'A single bent line — what **re**mains of れ once the loop is gone.',
  ロ: 'A square — a **ro**om seen from above.',
  ワ: 'A ウ with the chimney gone — the **wa**ter tank on the roof.',
  ヲ: 'The ラ shape with a stroke through it — the **o** particle.',
  ン: 'Like ソ, but the stroke sweeps up — a lazy **n**, katakana style.',
};

/**
 * The hook for one character, or null if there is none.
 *
 * Voiced and semi-voiced kana fall back to their base character on purpose —
 * が is か plus a mark, and the mark is a rule rather than a new shape.
 */
export function mnemonicFor(char: string): string | null {
  const direct = HIRAGANA[char] ?? KATAKANA[char];
  if (direct) return direct;

  const base = baseKana(char);
  if (base !== char) return HIRAGANA[base] ?? KATAKANA[base] ?? null;

  return null;
}

/**
 * A mnemonic for a whole kana string, when every character in it has one.
 *
 * Yōon (きゃ) are two characters and get two hooks, which is also how the study
 * screen draws them — two cells, two stroke diagrams.
 */
export function mnemonicsFor(kana: string): { char: string; hint: string }[] {
  const out: { char: string; hint: string }[] = [];
  for (const char of kana) {
    const hint = mnemonicFor(char);
    if (hint) out.push({ char, hint });
  }
  return out;
}
