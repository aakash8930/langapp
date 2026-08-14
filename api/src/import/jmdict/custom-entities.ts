const ENTITY_DECL_RE = /<!ENTITY\s+([A-Za-z0-9_-]+)\s+"([^"]*)">/g;

/** Reads the `<!ENTITY name "expansion">` declarations out of a DOCTYPE internal subset. */
export function extractEntities(rawXml: string): Map<string, string> {
  const entities = new Map<string, string>();
  for (const match of rawXml.matchAll(ENTITY_DECL_RE)) {
    const [, name, value] = match;
    entities.set(name, value);
  }
  return entities;
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * JMdict and KANJIDIC2 declare ~200 custom DOCTYPE entities (`&n;` ->
 * "noun (common) (futsuumeishi)", `&v5k;` -> a verb-conjugation class, ...)
 * that abbreviate part-of-speech/register tags. fast-xml-parser, like most
 * general-purpose XML parsers, does not read the DOCTYPE internal subset and
 * so cannot resolve them.
 *
 * Expanding every `&name;` occurrence to its declared text **before** the
 * document reaches the XML parser sidesteps that entirely — the parser only
 * ever sees plain content it already knows how to handle. This is a text
 * substitution pass, not an XML operation, which is what makes it testable
 * in isolation from fast-xml-parser's own behaviour.
 */
export function expandCustomEntities(rawXml: string): string {
  const entities = extractEntities(rawXml);
  if (entities.size === 0) return rawXml;

  const pattern = new RegExp(`&(${[...entities.keys()].map(escapeRegExp).join('|')});`, 'g');
  return rawXml.replace(pattern, (_match, name: string) => escapeXmlText(entities.get(name) ?? ''));
}
