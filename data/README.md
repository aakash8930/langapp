# LangApp language data

`raw/` is intentionally Git-ignored. It contains downloaded upstream source files, not application data.

## Download

```bash
bash tools/download-language-data.sh
```

The script currently downloads EDRDG JMdict/KANJIDIC2/KRADFILE and KanjiVG. It does not download Tatoeba or BCCWJ automatically: choose the exact export, record its license/provenance in `sources.json`, then import it deliberately.

## Required rules

1. Do not scrape third-party learning websites or use their content as a dataset.
2. Preserve source ID, source version, license, URL, and attribution for every import.
3. Do not label a third-party word list as an official JLPT list.
4. Use original or explicitly licensed content for production questions, grammar explanations, reading passages, and audio.
5. Review licensing terms before commercial use or redistribution; this repository does not grant third-party content rights.

## Expected layout

```text
data/
  sources.json        # committed metadata and attribution registry
  raw/                # ignored downloaded files
    edrdg/
    kanjivg/
    tatoeba/
    bccwj/
  processed/          # ignored normalized staging files
```
