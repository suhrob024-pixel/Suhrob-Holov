# alltiventduct.se

Hemsidan för **AlltiVent Duct AB**. Sidan är automatiserad: allt innehåll ligger i
en enda textfil, och varje gång den ändras byggs och publiceras sidan om av sig själv.

Du behöver aldrig röra HTML för att ändra text, priser, produkter eller e-postadresser.

---

## Så här ändrar du något

Allt innehåll finns i **[`content/site.json`](content/site.json)**.

| Vad du vill ändra | Var i filen |
|---|---|
| Rubrik, ingress och knappar högst upp | `hero` |
| Produkttabellen (artikelkoder) | `products.items` |
| Tillbehörslistan | `products.accessories` |
| Teknisk data | `tech.specs` |
| Tjänsterutorna | `services.items` |
| Miljöpunkterna | `env.points` |
| Adress, org.nr, bolagsnamn | `company` |
| E-postadresser (ändras på ett ställe, slår igenom överallt) | `emails` |
| Menyn | `nav` |
| Sidfoten | `footer` |
| Titel och text i Google-träffen | `meta` |

### Lägga till en produkt

Lägg till en rad i `products.items`:

```json
{ "code": "AKL", "name": "Ljuddämpare", "description": "Rektangulär ljuddämpare i standardlängder" }
```

Tabellen på sidan, samt produktdatan som Google läser, uppdateras automatiskt.

### Ändra en e-postadress

Ändra den **en gång** under `emails`. Adressen används på topplisten, i
kontaktrutorna, i sidfoten och i alla knappar — allt uppdateras samtidigt.

### Textmärkning i innehållet

I fälten `tech.specs[].value` och `about.facts[].text` går det att använda:

* `{mono:DX51D+Z}` — teknisk stil (monospace)
* `{b:Domnarvsgatan 12}` — fetstil

---

## Publicering

```
Du ändrar content/site.json  →  pushar  →  sidan är uppe inom ~1 minut
```

Produktionsgrenen är **`claude/website-automation-o26eu3`**. Push dit publicerar sidan.

| Workflow | När den körs | Vad den gör |
|---|---|---|
| `Bygg och publicera` | push till produktionsgrenen | Bygger sidan och publicerar den på GitHub Pages |
| `Kontroll` | pull request eller annan gren | Validerar innehållet och sparar en förhandsgranskning som artefakt |

### Kvar att göra i GitHub

1. **Settings → Pages → Source:** välj **GitHub Actions**.
   *Tills detta är gjort misslyckas publiceringen med `Pages is not enabled` — bygget
   och kontrollen fungerar ändå. Felet försvinner av sig självt när inställningen är på.*
2. Egen domän: **Settings → Pages → Custom domain** → `alltiventduct.se`, och peka
   DNS mot GitHub Pages. Lägg sedan en fil `public/CNAME` som innehåller `alltiventduct.se`.

### Om du vill byta till en `main`-gren senare

Repot var tomt när det sattes upp, så grenen ovan blev standardgren. Vill du hellre
ha `main`: byt namn på grenen under **Settings → Branches**, och ändra sedan
grennamnet på en rad i `deploy.yml` och en rad i `kontroll.yml`.

---

## Vad kontrollen fångar

Bygget stoppas — och sidan publiceras inte — om något av detta är fel:

* obligatoriska fält saknas eller är tomma (adress, org.nr, e-post, produkter …)
* ogiltig e-postadress
* dubblerad artikelkod i produktprogrammet
* en meny- eller sidfotslänk pekar på en sektion som inte finns
* en `mailto:`-länk går till en adress som inte står under `emails`
* mallen refererar till ett fält som inte finns i innehållsfilen
* trasig JSON-LD, saknad `<h1>`, bild utan alt-text

Varningar (stoppar inte bygget): för lång sidtitel eller metabeskrivning.

---

## Arbeta lokalt

Kräver Node 20 eller senare. Inga beroenden att installera.

```bash
npm run dev     # förhandsgranskning på http://localhost:3000, bygger om vid varje ändring
npm run build   # bygger till dist/
npm run check   # validerar utan att skriva något
```

---

## Filer

```
content/site.json        allt innehåll — det är den här filen du redigerar
src/template.html        sidans struktur (HTML)
src/styles.css           formgivning
public/                  filer som kopieras rakt av (favikon, ev. CNAME, bilder)
build.js                 bygger och validerar
scripts/dev.js           lokal server med automatisk ombyggnad
dist/                    resultatet — genereras, ligger inte i git
```

Sidan genereras som **en enda självförsörjande HTML-fil** med stilarna inbakade.
Utöver Google Fonts laddas inget externt, och det finns ingen JavaScript på sidan.
Bygget skapar även `sitemap.xml`, `robots.txt` och strukturerad produktdata (JSON-LD)
åt sökmotorerna.
