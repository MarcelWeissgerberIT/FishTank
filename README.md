# 🐠 FishTank – immersives 3D-Aquarium im Browser

Ein echtes 3D-Aquarium, das in deinem Wohnzimmer steht: Glasbecken auf einem Holzunterschrank,
LED-Lampe, Kaustik-Lichtnetz auf dem Sand, Lichtstrahlen, Luftblasen und Fische, die als Schwarm
schwimmen, fressen und vor dem Klopfen an der Scheibe flüchten.

**Live:** https://marcelweissgerberit.github.io/FishTank/

## Features

- **19 Tierarten**, alle als echte 3D-Modelle
  - Salzwasser: Clownfisch, Paletten-Doktorfisch, Gelber Segelflossendoktor, Mandarinfisch, Halfterfisch, Rotfeuerfisch, Königs-Feenbarsch
  - Süßwasser: Neonsalmler, Skalar, Diskus, Kampffisch, Goldfisch, Panzerwels
  - 🦈 **Haie:** Schwarzspitzen-Riffhai, Epaulettenhai (läuft über den Boden), Bala-Hai
  - 🪼 **Leuchtquallen:** knallbunt, durchsichtig, pulsierend, mit Regenbogen-Wimpernreihen und wehenden Tentakeln
- **7 Szenen-Presets:** Korallenriff, Amazonas, Iwagumi, Quallen-Lounge, Hai-Lagune, Goldfisch-Klassik, Leeres Becken
- **Lichtstimmungen:** Tageslicht, Riff-Blau (Korallen fluoreszieren), Sonnenaufgang, Mondlicht, Regenbogen, Gewitter, Party
  – plus eigene Licht- und Wasserfarbe, Helligkeit, Wasserklarheit, Raumlicht
- **Realistische Effekte:** animierte Kaustiken mit Schattenwurf, Lichtstrahlen, Wasseroberfläche mit Totalreflexion,
  Lichtabsorption im Wasser, gespiegelte Seitenscheiben, Schwebeteilchen, Luftblasen, Bloom
- **Verhalten:** Schwärme (Boids), Revier-Clownfische an der Anemone, Panzerwelse, die zum Luftholen nach oben schießen,
  patrouillierende Haie, Füttern und Erschrecken
- **Kamera:** frei drehen/zoomen, Perspektiven (frontal, Ecke, oben, Sofa, im Wasser), Kino-Modus, einem Fisch folgen
- **Vollbild & Immersiv-Modus** (UI komplett ausblenden), Ambient-Sound, Einstellungen werden gespeichert

## Steuerung

| Aktion | Maus / Touch | Taste |
| --- | --- | --- |
| Umsehen | ziehen | |
| Zoomen | Scrollrad / Pinch | |
| Füttern | Klick ins Wasser oder 🍤 | `Leertaste` |
| Fisch-Infos | Klick auf einen Fisch | |
| An die Scheibe klopfen | ✊ | `K` |
| Kino-Kamera | 🎬 | `C` |
| Vollbild | ⛶ | `F` |
| UI ausblenden | 👁 | `H` |
| Szenen | Menü → Szenen | `1`–`7` |

## Entwicklung

```bash
npm install
npm run dev      # lokaler Dev-Server
npm run build    # Produktions-Build nach dist/
```

Gebaut mit [three.js](https://threejs.org) und [Vite](https://vite.dev). Jeder Push auf `main` baut die Seite per
GitHub Actions und veröffentlicht sie auf dem Branch `gh-pages` (GitHub Pages).

## Assets

Alle Fische, Haie, Korallen, Steine, Wurzeln, Texturen und Hintergründe wurden mit **Higgsfield** erzeugt
(Bilder: GPT Image 2.5, 3D-Modelle: Tripo H3.1 Image-to-3D) und anschließend mit glTF-Transform
(Meshopt + WebP) fürs Web optimiert. Pflanzen, Quallen, Wasser und Licht-Effekte sind prozedural.
