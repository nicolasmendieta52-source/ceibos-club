export const BRICK_COUNT = 60;
const SPONSOR_LOGOS = {
  FNC: ['fnc.png'], FIXED: ['fixed.png', true], PQUICK: ['pquick.svg'],
  CATIVELLI: ['cattivelli.jpg'], CATTIVELLI: ['cattivelli.jpg'],
  MEGAAGRO: ['megaagro.svg'], BLUECROSS: ['bluecross.png'], ACSA: ['acsa.webp', true],
  SUBARU: ['subaru.png']
};

export function sponsorLogo(name) {
  const normalized = String(name).trim().toUpperCase();
  if (['KAZ', 'KAS', 'KAS INSURANCE BROKERS'].includes(normalized)) return {
    viewBox: '230 785 510 198', src: '/assets/sponsors/kas-reference.jpeg',
    width: 945, height: 2048, label: 'KAS Insurance Brokers'
  };
  const referenceLogos = {
    CATIVELLI: '605 206 114 54', CATTIVELLI: '605 206 114 54',
    FIXED: '1057 201 115 61', ACSA: '774 304 99 45'
  };
  if (referenceLogos[normalized]) return { viewBox: referenceLogos[normalized] };
  if (normalized === 'DEDISEÑO') return { viewBox: '161 295 145 57' };
  if (normalized === 'DOMINION') return { viewBox: '878 210 160 45' };
  const entry = SPONSOR_LOGOS[normalized];
  return entry ? { src: `/assets/sponsors/${entry[0]}`, dark: Boolean(entry[1]), monochrome: normalized === 'FNC' } : null;
}
const FALLBACK_CONTACT = 'mailto:info@ceibosclub.com?subject=Quiero%20colaborar%20con%20el%20Gimnasio%20de%20Ceibos';

export function campaignModel(data) {
  if (!data || typeof data.goal !== 'number' || !Number.isFinite(data.goal) || data.goal <= 0 ||
      typeof data.raised !== 'number' || !Number.isFinite(data.raised) || data.raised < 0) {
    throw new TypeError('La campaña requiere goal > 0 y raised >= 0, como números finitos.');
  }
  const progress = Math.min(data.raised / data.goal, 1);
  if (data.brickProgress !== undefined && (!Array.isArray(data.brickProgress) || data.brickProgress.length !== BRICK_COUNT ||
      data.brickProgress.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1))) throw new TypeError('Avance por ladrillo inválido.');
  if (data.brickSponsors !== undefined && (!Array.isArray(data.brickSponsors) || data.brickSponsors.length !== BRICK_COUNT ||
      data.brickSponsors.some(n => typeof n !== 'boolean'))) throw new TypeError('Tipos de ladrillo inválidos.');
  // Migrate older cached snapshots as well: companies never consume wall slots.
  const sponsors = [...new Set([...(data.sponsors || []).filter(name => String(name).trim().toUpperCase() !== 'EUROPCAR'), ...(data.brickLabels || []).filter((_, i) => data.brickSponsors?.[i] && String(data.brickLabels[i]).trim().toUpperCase() !== 'EUROPCAR')])];
  const brickLabels = data.brickLabels?.map((name, i) => data.brickSponsors?.[i] ? '' : name);
  const fills = (data.brickProgress || Array.from({ length: BRICK_COUNT }, (_, i) => Math.max(0, Math.min(1, progress * BRICK_COUNT - i))))
    .map((fill, i) => data.brickSponsors?.[i] ? 0 : fill);
  return {
    ...data, sponsors, brickLabels, brickSponsors: Array(BRICK_COUNT).fill(false), brickProgress: data.brickProgress ? fills : undefined, progress, percent: progress * 100,
    remaining: Math.max(0, data.goal - data.raised), brickValue: data.goal / BRICK_COUNT,
    fills
  };
}

export function brickPosition(index, columns) {
  return { row: BRICK_COUNT / columns - Math.floor(index / columns), column: index % columns + 1 };
}

// Keep each ledger ID attached to its data; only its visual position changes.
export function brickLayout(data, columns) {
  const contributors = [], empty = [];
  for (let i = 0; i < BRICK_COUNT; i++) {
    if (data.brickLabels?.[i]?.trim() || data.fills?.[i] > 0) contributors.push(i);
    else empty.push(i);
  }
  const order = [...contributors, ...empty];
  const positions = [];
  order.forEach((id, index) => { positions[id] = brickPosition(index, columns); });
  return positions;
}

export function contributionLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return url.href;
  } catch { /* El correo del club funciona mientras no haya formulario. */ }
  return FALLBACK_CONTACT;
}

// La pestaña publicada solo contiene totales y nombres aprobados, nunca pagos individuales.
export function campaignFromCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new TypeError('CSV incompleto.');
  if (field || row.length) { row.push(field); rows.push(row); }
  if (rows[0]?.[0]?.replace(/^\uFEFF/, '') !== 'Campo' || rows[0]?.[1] !== 'Valor') throw new TypeError('Fuente inesperada.');
  const values = new Map();
  for (const entry of rows.slice(1)) {
    if (entry.length !== 2 || values.has(entry[0])) throw new TypeError('Filas incompletas o duplicadas.');
    values.set(entry[0], entry[1]);
  }
  const numeric = key => {
    const value = values.get(key)?.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(value || '')) throw new TypeError(`Valor inválido: ${key}`);
    return Number(value.replace(',', '.'));
  };
  if (numeric('brickCount') !== BRICK_COUNT) throw new TypeError('Se esperan 60 ladrillos.');
  const brickLabels = Array.from({ length: BRICK_COUNT }, (_, i) => {
    const key = `brick${i + 1}`;
    if (!values.has(key)) throw new TypeError('Faltan ladrillos en la fuente.');
    const name = values.get(key).trim();
    if (name.length > 160 || /^#(REF!|VALUE!|ERROR!|N\/A|DIV\/0!|NAME\?)/.test(name)) throw new TypeError('Nombre inválido.');
    return name.replace(/ y flia$/, '\ny flia');
  });
  return campaignModel({ goal: numeric('goal'), raised: numeric('raised'), brickLabels });
}

export function initCampaign(root) {
  const select = name => root.querySelector(`[data-gym-${name}]`);
  const money = value => `USD ${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(value)}`;
  const percentage = value => new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(value);
  const wall = select('wall');
  const status = select('status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = null;
  let visible = false;
  let pending = false;
  let disposed = false;
  const bricks = Array.from({ length: BRICK_COUNT }, (_, i) => {
    const brick = document.createElement('span');
    brick.className = 'gym-brick';
    const fill = document.createElement('span');
    fill.className = 'gym-brick-fill';
    brick.append(fill);
    const label = document.createElement('span');
    label.className = 'gym-brick-label';
    brick.append(label);
    brick.addEventListener('animationend', () => brick.classList.remove('is-placing'));
    wall.append(brick);
    return brick;
  });

  function animate(indices) {
    if (!visible || reducedMotion.matches) return;
    indices.forEach((index, order) => {
      const brick = bricks[index];
      brick.classList.remove('is-placing');
      brick.style.setProperty('--delay', `${Math.min(order * 45, 500)}ms`);
      // Restart a placement even when a second contribution reaches the same brick.
      void brick.offsetWidth;
      brick.classList.add('is-placing');
    });
  }

  let lastSponsors = '';
  function renderSponsors(names) {
    const list = select('sponsors');
    if (!list || JSON.stringify(names) === lastSponsors) return;
    lastSponsors = JSON.stringify(names);
    list.replaceChildren();
    for (const name of names) {
      const item = document.createElement('li');
      item.className = 'gym-sponsor';
      const logo = sponsorLogo(name);
      if (logo?.viewBox) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', logo.viewBox);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', logo.label || name);
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        const clipId = `gym-sponsor-crop-${list.children.length}`;
        clip.setAttribute('id', clipId);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const bounds = logo.viewBox.split(' ');
        ['x', 'y', 'width', 'height'].forEach((key, index) => rect.setAttribute(key, bounds[index]));
        clip.append(rect); svg.append(clip);
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('clip-path', `url(#${clipId})`);
        image.setAttribute('href', logo.src || '/assets/sponsors/club-sponsors-reference.png');
        image.setAttribute('width', String(logo.width || 1179)); image.setAttribute('height', String(logo.height || 456));
        svg.append(image); item.append(svg);
      } else if (logo) {
        const img = document.createElement('img');
        img.src = logo.src; img.alt = name; img.decoding = 'async';
        if (logo.monochrome) img.classList.add('gym-sponsor-monochrome');
        if (logo.dark) item.classList.add('gym-sponsor-dark');
        img.addEventListener('error', () => { item.textContent = name; item.classList.remove('gym-sponsor-dark'); });
        item.append(img);
      } else item.textContent = name;
      list.append(item);
    }
  }

  function render(data) {
    const next = campaignModel(data);
    const previous = current;
    const changed = [];
    const desktopLayout = brickLayout(next, 10);
    const mobileLayout = brickLayout(next, 5);
    bricks.forEach((brick, i) => {
      for (const [prefix, position] of [['', desktopLayout[i]], ['mobile-', mobileLayout[i]]]) {
        brick.style.setProperty(`--${prefix}row`, position.row);
        brick.style.setProperty(`--${prefix}column`, position.column);
      }
      brick.style.setProperty('--fill', `${next.fills[i] * 100}%`);
      brick.classList.toggle('is-partial', next.fills[i] > 0 && next.fills[i] < 1);
      brick.classList.remove('is-placing');
      const label = Array.isArray(next.brickLabels) ? next.brickLabels[i] : '';
      const sponsor = Boolean(next.brickSponsors?.[i]);
      brick.classList.toggle('is-sponsor', sponsor);
      brick.querySelector('.gym-brick-label').textContent = typeof label === 'string' ? label : '';
      brick.classList.toggle('has-contributor', Boolean(label));
      brick.classList.toggle('has-unfilled-label', Boolean(label) && next.fills[i] < 1);
      brick.title = `Ladrillo ${i + 1}${label ? ` · ${label.replace(/\s+/g, ' ')}` : ''}${sponsor ? ' · Sponsor' : ''}`;
      if (previous && (next.fills[i] > previous.fills[i] || (label && label !== previous.brickLabels?.[i]) || sponsor !== Boolean(previous.brickSponsors?.[i]))) changed.push(i);
    });
    renderSponsors(next.sponsors);
    const names = Array.isArray(next.brickLabels)
      ? next.brickLabels.map((name, i) => typeof name === 'string' && name.trim() ? `${name.replace(/\s+/g, ' ')}${next.brickSponsors?.[i] ? ' (sponsor)' : ''}` : '').filter(Boolean) : [];
    select('contributors').textContent = names.length ? `Nos acompañan: ${names.join('; ')}.` : '';
    select('raised').textContent = money(next.raised);
    select('goal').textContent = money(next.goal);
    select('remaining').textContent = money(next.remaining);
    select('percent').textContent = `${percentage(next.percent)}%`;
    select('progress').value = next.percent;
    select('progress').setAttribute('aria-valuetext', `${percentage(next.percent)}% de la meta. ${money(next.raised)} recaudados de ${money(next.goal)}.`);
    select('unit').textContent = next.brickProgress ? 'un aporte al gimnasio' : money(next.brickValue);
    select('wall-summary').textContent = next.brickProgress
      ? `${names.length} de ${BRICK_COUNT} ladrillos ocupados`
      : `${Math.floor(next.progress * BRICK_COUNT)} de ${BRICK_COUNT} ladrillos completos`;
    const cta = select('cta');
    cta.href = contributionLink(next.contributionUrl);
    const external = cta.href.startsWith('https:');
    if (external) { cta.target = '_blank'; cta.rel = 'noopener noreferrer'; }
    else { cta.removeAttribute('target'); cta.removeAttribute('rel'); }
    select('contact-note').textContent = external ? 'Completá tus datos para registrar tu colaboración.' : 'Escribile al club para coordinar tu aporte.';
    const updated = next.updatedAt ? new Date(next.updatedAt) : null;
    select('updated').textContent = updated && !Number.isNaN(updated.getTime())
      ? `Datos al ${new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeZone: 'UTC' }).format(updated)}.` : '';
    status.textContent = previous && next.raised > previous.raised
      ? `¡Un paso más! Se sumaron ${money(next.raised - previous.raised)} al gimnasio.` : '';
    if (next.progress === 1) status.textContent = '¡Meta alcanzada! Gracias por construir el gimnasio entre todos.';
    current = next;
    if (!previous && visible) animate([Math.max(0, next.fills.findLastIndex(fill => fill > 0))].filter(i => next.fills[i] > 0));
    else animate(changed);
  }

  const observer = new IntersectionObserver(entries => {
    const wasVisible = visible;
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && !wasVisible && current) {
      const last = current.fills.findLastIndex(fill => fill > 0);
      if (last >= 0) animate([last]);
    }
  }, { threshold: .15 });
  observer.observe(wall);

  async function readJson(url) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Campaña: HTTP ${response.status}`);
    return response.json();
  }

  async function refresh() {
    if (pending || disposed || document.hidden) return;
    pending = true;
    try {
      const config = await readJson(`/data/gym-campaign.json?v=${Math.floor(Date.now() / 60000)}`);
      let data = config;
      let sourceFailed = false;
      if (config.sourceUrl) {
        try {
          const url = new URL(config.sourceUrl, window.location.href);
          if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error('Fuente no válida');
          let live;
          if (config.sourceFormat === 'sheets-csv') {
            const response = await fetch(url.href, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error(`Campaña: HTTP ${response.status}`);
            live = campaignFromCsv(await response.text());
          } else live = await readJson(url.href);
          campaignModel(live);
          data = { ...config, goal: live.goal, raised: live.raised, updatedAt: live.updatedAt || '', brickLabels: live.brickLabels || config.brickLabels || [], brickProgress: live.brickProgress, brickSponsors: live.brickSponsors, sponsors: live.sponsors };
        } catch {
          // Preserve the last verified live amounts instead of reverting to an old local snapshot.
          if (current) data = { ...config, goal: current.goal, raised: current.raised, updatedAt: current.updatedAt, brickLabels: current.brickLabels, brickProgress: current.brickProgress, brickSponsors: current.brickSponsors, sponsors: current.sponsors };
          sourceFailed = true;
        }
      }
      if (disposed) return;
      render(data);
      if (sourceFailed) status.textContent = 'No pudimos actualizar ahora. Mostramos el último dato disponible.';
    } catch {
      if (!disposed) {
        status.textContent = current
          ? 'No pudimos actualizar ahora. Mostramos el último dato disponible.'
          : 'El avance no está disponible en este momento. Podés consultar al club para colaborar.';
        if (!current) {
          select('raised').textContent = 'Sin datos';
          select('progress').removeAttribute('value');
        }
      }
    } finally { pending = false; }
  }

  const onVisibility = () => { if (!document.hidden) refresh(); };
  const onUpdate = event => {
    try { render({ ...current, ...event.detail }); }
    catch { status.textContent = 'No pudimos validar la actualización. Se conserva el último dato disponible.'; }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('ceibos:gym-update', onUpdate);
  const timer = window.setInterval(refresh, 60000);
  refresh();
  return () => {
    disposed = true;
    window.clearInterval(timer);
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('ceibos:gym-update', onUpdate);
  };
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('gym-campaign');
  if (root) initCampaign(root);
}
