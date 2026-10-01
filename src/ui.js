import { SPECIES, JELLY_SPECIES } from './fish/species.js';
import { PRESETS, LIGHT_MODES, BACKDROPS } from './presets.js';
import { asset } from './config.js';

const GROUPS = [
  { title: 'Salzwasser', filter: (s) => s.water === 'salt' && s.group === 'fish' },
  { title: 'Süßwasser', filter: (s) => s.water === 'fresh' && s.group === 'fish' },
  { title: 'Haie', filter: (s) => s.group === 'shark' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createUI(app) {
  const root = document.getElementById('ui');
  let tab = 'fish';
  try {
    tab = localStorage.getItem('fishtank:tab') || 'fish';
  } catch (e) {
    /* ignore */
  }
  let panelOpen = window.innerWidth > 820;
  let hidden = false;
  let keepFish = false;

  const card = (s) => `
    <div class="species" data-id="${s.id}">
      <div class="thumb">${s.group === 'jelly' ? '<span class="jelly-thumb">🪼</span>' : `<img src="${asset(`thumbs/${s.id}.webp`)}" alt="" loading="lazy">`}</div>
      <div class="sp-info">
        <div class="sp-name">${esc(s.name)}</div>
        <div class="sp-latin">${esc(s.latin)}</div>
      </div>
      <div class="stepper">
        <button class="ic" data-act="remove" data-id="${s.id}" aria-label="Entfernen">−</button>
        <span class="count" data-count="${s.id}">0</span>
        <button class="ic add" data-act="add" data-id="${s.id}" aria-label="Hinzufügen">+</button>
      </div>
    </div>`;

  root.innerHTML = `
    <header class="brand glass">
      <div class="logo">🐠</div>
      <div>
        <div class="title">FishTank</div>
        <div class="subtitle" id="preset-name"></div>
      </div>
    </header>

    <div class="top-actions">
      <button class="glass round" data-act="sound" title="Sound"><span id="snd-ic">🔇</span></button>
      <button class="glass round" data-act="hide" title="Immersiv (H)">👁</button>
      <button class="glass round" data-act="fullscreen" title="Vollbild (F)">⛶</button>
      <button class="glass round" data-act="panel" title="Menü">☰</button>
    </div>

    <aside class="panel glass" id="panel">
      <nav class="tabs">
        <button data-tab="fish">🐟 Fische</button>
        <button data-tab="scene">🪸 Szenen</button>
        <button data-tab="light">💡 Licht</button>
        <button data-tab="cam">🎥 Kamera</button>
      </nav>
      <div class="tab-body">
        <section data-pane="fish">
          <div class="row stats"><span id="fish-total">0 Tiere</span><button class="chip danger" data-act="clear">Alle entfernen</button></div>
          <div class="warn" id="mix-warn" hidden>🧪 Fantasie-Modus: Süß- und Salzwasser­tiere gemischt</div>
          ${GROUPS.map((g) => `<h4>${g.title}</h4><div class="species-list">${SPECIES.filter(g.filter).map(card).join('')}</div>`).join('')}
          <h4>Quallen</h4>
          <div class="species-list">${card(JELLY_SPECIES)}</div>
        </section>

        <section data-pane="scene">
          <div class="presets">
            ${Object.entries(PRESETS)
              .map(
                ([id, p], i) => `
              <button class="preset" data-preset="${id}">
                <span class="p-icon">${p.icon}</span>
                <span class="p-text"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></span>
                <kbd>${i + 1}</kbd>
              </button>`
              )
              .join('')}
          </div>
          <label class="check"><input type="checkbox" id="keep-fish"> Fische beim Szenenwechsel behalten</label>
          <h4>Rückwand</h4>
          <div class="chips" id="backdrops">
            ${Object.entries(BACKDROPS).map(([id, n]) => `<button class="chip" data-backdrop="${id}">${n}</button>`).join('')}
          </div>
        </section>

        <section data-pane="light">
          <h4>Lichtstimmung</h4>
          <div class="chips" id="lights">
            ${Object.entries(LIGHT_MODES).map(([id, m]) => `<button class="chip" data-light="${id}">${esc(m.name)}</button>`).join('')}
          </div>
          <label class="slider">Helligkeit <input type="range" min="0.15" max="1.8" step="0.01" data-set="intensity"></label>
          <label class="slider">Raumlicht <input type="range" min="0" max="1" step="0.01" data-set="room"></label>
          <label class="slider">Wasserklarheit <input type="range" min="0.25" max="2.5" step="0.01" data-set="clarity"></label>
          <div class="colors">
            <label>Lichtfarbe <input type="color" data-color="lightColor"><button class="chip mini" data-reset="lightColor">↺</button></label>
            <label>Wasserfarbe <input type="color" data-color="waterTint"><button class="chip mini" data-reset="waterTint">↺</button></label>
          </div>
          <h4>Effekte</h4>
          <div class="toggles">
            ${[
              ['caustics', 'Lichtnetz (Kaustik)'],
              ['rays', 'Lichtstrahlen'],
              ['bubbles', 'Luftblasen'],
              ['particles', 'Schwebeteilchen'],
              ['bloom', 'Glühen'],
            ]
              .map(([k, n]) => `<label class="switch"><input type="checkbox" data-toggle="${k}"><span></span>${n}</label>`)
              .join('')}
          </div>
        </section>

        <section data-pane="cam">
          <h4>Perspektive</h4>
          <div class="chips">
            ${[
              ['front', 'Frontal'],
              ['close', 'Nah dran'],
              ['corner', 'Ecke'],
              ['top', 'Von oben'],
              ['sofa', 'Vom Sofa'],
              ['inside', 'Im Wasser'],
            ]
              .map(([v, n]) => `<button class="chip" data-view="${v}">${n}</button>`)
              .join('')}
          </div>
          <h4>Modus</h4>
          <div class="chips">
            <button class="chip" data-cam="orbit">🖐 Frei</button>
            <button class="chip" data-cam="cinema">🎬 Kino</button>
            <button class="chip" data-cam="follow">🐟 Fisch folgen</button>
          </div>
          <h4>Anzeige</h4>
          <div class="chips">
            <button class="chip" data-act="fullscreen">⛶ Vollbild</button>
            <button class="chip" data-act="hide">👁 Immersiv (UI aus)</button>
          </div>
          <p class="keys">
            <kbd>Maus ziehen</kbd> umsehen · <kbd>Scroll</kbd> zoomen · <kbd>Rechtsklick</kbd> verschieben<br>
            <kbd>Klick ins Wasser</kbd> füttern · <kbd>Klick auf Fisch</kbd> Infos<br>
            <kbd>F</kbd> Vollbild · <kbd>H</kbd> UI aus · <kbd>Leertaste</kbd> füttern · <kbd>K</kbd> klopfen · <kbd>C</kbd> Kino · <kbd>1–7</kbd> Szenen
          </p>
        </section>
      </div>
    </aside>

    <div class="dock glass">
      <button data-act="feed" title="Füttern (Leertaste)">🍤<span>Füttern</span></button>
      <button data-act="knock" title="An die Scheibe klopfen (K)">✊<span>Klopfen</span></button>
      <button data-cam="cinema" title="Kino-Kamera (C)">🎬<span>Kino</span></button>
      <button data-cam="follow" title="Einem Fisch folgen">🐟<span>Folgen</span></button>
      <button data-act="fullscreen" title="Vollbild (F)">⛶<span>Vollbild</span></button>
    </div>

    <div class="fish-card glass" id="fish-card" hidden>
      <button class="close" data-act="close-card">×</button>
      <img id="fc-img" alt="">
      <div class="fc-body">
        <div class="fc-name" id="fc-name"></div>
        <div class="fc-latin" id="fc-latin"></div>
        <p id="fc-desc"></p>
        <div class="chips">
          <button class="chip" data-cam="follow">🐟 Folgen</button>
          <button class="chip" data-act="add-same">+ noch einer</button>
        </div>
      </div>
    </div>

    <div class="toast" id="toast"></div>
    <button class="unhide glass round" data-act="hide" title="UI zeigen (H)">👁</button>
  `;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const panel = $('#panel');
  const toast = $('#toast');
  let toastTimer;

  function hint(text, ms = 2200) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
  }

  function setTab(t) {
    tab = t;
    try {
      localStorage.setItem('fishtank:tab', t);
    } catch (e) {
      /* ignore */
    }
    $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== t));
  }

  function toggleHidden(force) {
    hidden = force ?? !hidden;
    document.body.classList.toggle('immersive', hidden);
    if (hidden) hint('Immersiv-Modus · H oder 👁 zum Zurückkehren', 2500);
  }

  function refresh() {
    const s = app.state;
    const p = PRESETS[s.preset];
    $('#preset-name').textContent = `${p?.icon ?? ''} ${p?.name ?? ''} · ${LIGHT_MODES[s.light]?.name ?? ''}`;
    $$('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === s.preset));
    $$('[data-light]').forEach((b) => b.classList.toggle('active', b.dataset.light === s.light));
    $$('[data-backdrop]').forEach((b) => b.classList.toggle('active', b.dataset.backdrop === s.backdrop));
    $$('[data-cam]').forEach((b) => b.classList.toggle('active', b.dataset.cam === app.camMode));
    $$('[data-toggle]').forEach((i) => (i.checked = !!s[i.dataset.toggle]));
    $$('[data-set]').forEach((i) => {
      if (document.activeElement !== i) i.value = s[i.dataset.set];
    });
    const lm = LIGHT_MODES[s.light];
    $('[data-color="lightColor"]').value = s.lightColor ?? lm.color;
    $('[data-color="waterTint"]').value = s.waterTint ?? p.water.scatter;
    $('#snd-ic').textContent = s.sound ? '🔊' : '🔇';
    const counts = app.counts();
    counts.jelly = app.jellies.count;
    let total = 0;
    let salt = false;
    let fresh = false;
    $$('[data-count]').forEach((el) => {
      const n = counts[el.dataset.count] ?? 0;
      el.textContent = n;
      el.closest('.species').classList.toggle('has', n > 0);
    });
    for (const [id, n] of Object.entries(counts)) {
      total += n;
      const sp = SPECIES.find((x) => x.id === id);
      if (sp?.water === 'salt') salt = true;
      if (sp?.water === 'fresh') fresh = true;
    }
    $('#fish-total').textContent = `${total} ${total === 1 ? 'Tier' : 'Tiere'} im Becken`;
    $('#mix-warn').hidden = !(salt && fresh);
    root.classList.toggle('busy', !!app.busy);
  }

  function showFish(f) {
    const el = $('#fish-card');
    if (!f) {
      el.hidden = true;
      return;
    }
    const s = f.sp;
    $('#fc-img').src = asset(`thumbs/${s.id}.webp`);
    $('#fc-name').textContent = s.name;
    $('#fc-latin').textContent = s.latin;
    $('#fc-desc').textContent = s.desc;
    el.hidden = false;
  }

  // ------------- events
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.tab) setTab(d.tab);
    if (d.preset) {
      hint(`${PRESETS[d.preset].icon} ${PRESETS[d.preset].name} wird eingerichtet …`);
      await app.setPreset(d.preset, { keepFish });
    }
    if (d.light) app.set('light', d.light), app.set('lightColor', null);
    if (d.backdrop) app.set('backdrop', d.backdrop);
    if (d.view) app.view(d.view);
    if (d.cam) {
      if (d.cam === 'follow' && !app.fish.total) hint('Keine Fische zum Folgen 🙁');
      app.setCamMode(app.camMode === d.cam && d.cam !== 'orbit' ? 'orbit' : d.cam);
      if (app.camMode === 'follow' && app.selected) showFish(app.selected);
    }
    if (d.reset) app.set(d.reset, null);
    switch (d.act) {
      case 'add':
        b.classList.add('pop');
        setTimeout(() => b.classList.remove('pop'), 250);
        await app.addFish(d.id, d.id === 'neon' ? 3 : 1);
        break;
      case 'remove':
        app.removeFish(d.id, d.id === 'neon' ? 3 : 1);
        break;
      case 'clear':
        app.clearFish();
        hint('Becken geleert');
        break;
      case 'feed':
        app.feed();
        hint('Futter! 🍤', 1200);
        break;
      case 'knock':
        app.knock();
        hint('Tock tock! ✊', 1200);
        break;
      case 'fullscreen':
        app.toggleFullscreen();
        break;
      case 'hide':
        toggleHidden();
        break;
      case 'panel':
        panelOpen = !panelOpen;
        panel.classList.toggle('open', panelOpen);
        break;
      case 'sound':
        app.set('sound', !app.state.sound);
        break;
      case 'close-card':
        showFish(null);
        app.selected = null;
        break;
      case 'add-same':
        if (app.selected) await app.addFish(app.selected.sp.id, 1);
        break;
    }
    refresh();
  });

  root.addEventListener('input', (e) => {
    const i = e.target;
    if (i.dataset.set) app.set(i.dataset.set, parseFloat(i.value));
    if (i.dataset.color) app.set(i.dataset.color, i.value);
  });
  root.addEventListener('change', (e) => {
    const i = e.target;
    if (i.dataset.toggle) app.set(i.dataset.toggle, i.checked);
    if (i.id === 'keep-fish') keepFish = i.checked;
  });

  panel.classList.toggle('open', panelOpen);
  setTab(tab);
  app.onChange(refresh);
  refresh();
  setTimeout(() => hint('Ziehen zum Umsehen · Klick ins Wasser zum Füttern · F für Vollbild', 5000), 1500);

  return { refresh, showFish, hint, toggleHidden };
}
