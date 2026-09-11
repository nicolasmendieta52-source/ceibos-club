const BRICK_COUNT = 100;
const FALLBACK_CONTACT = 'mailto:info@ceibosclub.com?subject=Quiero%20colaborar%20con%20el%20Gimnasio%20de%20Ceibos';

export function campaignModel(data) {
  if (!data || typeof data.goal !== 'number' || !Number.isFinite(data.goal) || data.goal <= 0 ||
      typeof data.raised !== 'number' || !Number.isFinite(data.raised) || data.raised < 0) {
    throw new TypeError('La campaña requiere goal > 0 y raised >= 0, como números finitos.');
  }
  const progress = Math.min(data.raised / data.goal, 1);
  return {
    ...data, progress, percent: progress * 100,
    remaining: Math.max(0, data.goal - data.raised), brickValue: data.goal / BRICK_COUNT,
    fills: Array.from({ length: BRICK_COUNT }, (_, i) => Math.max(0, Math.min(1, progress * BRICK_COUNT - i)))
  };
}

export function contributionLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return url.href;
  } catch { /* El correo del club funciona mientras no haya formulario. */ }
  return FALLBACK_CONTACT;
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

  function render(data) {
    const next = campaignModel(data);
    const previous = current;
    const changed = [];
    bricks.forEach((brick, i) => {
      brick.style.setProperty('--fill', `${next.fills[i] * 100}%`);
      brick.classList.toggle('is-partial', next.fills[i] > 0 && next.fills[i] < 1);
      brick.classList.remove('is-placing');
      const label = next.fills[i] > 0 && Array.isArray(next.brickLabels) ? next.brickLabels[i] : '';
      brick.querySelector('.gym-brick-label').textContent = typeof label === 'string' ? label : '';
      if (previous && next.fills[i] > previous.fills[i]) changed.push(i);
    });
    const names = Array.isArray(next.brickLabels)
      ? next.brickLabels.filter((name, i) => next.fills[i] > 0 && typeof name === 'string' && name.trim()).map(name => name.replace(/\s+/g, ' ')) : [];
    select('contributors').textContent = names.length ? `Aportaron: ${names.join('; ')}.` : '';
    select('raised').textContent = money(next.raised);
    select('goal').textContent = money(next.goal);
    select('remaining').textContent = money(next.remaining);
    select('percent').textContent = `${percentage(next.percent)}%`;
    select('progress').value = next.percent;
    select('progress').setAttribute('aria-valuetext', `${percentage(next.percent)}% de la meta. ${money(next.raised)} recaudados de ${money(next.goal)}.`);
    select('unit').textContent = money(next.brickValue);
    select('wall-summary').textContent = `${Math.floor(next.progress * BRICK_COUNT)} de 100 ladrillos completos`;
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
      const config = await readJson('/data/gym-campaign.json');
      let data = config;
      let sourceFailed = false;
      if (config.sourceUrl) {
        try {
          const url = new URL(config.sourceUrl, window.location.href);
          if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error('Fuente no válida');
          const live = await readJson(url.href);
          campaignModel(live);
          data = { ...config, goal: live.goal, raised: live.raised, updatedAt: live.updatedAt || '', brickLabels: live.brickLabels || config.brickLabels || [] };
        } catch {
          // Preserve the last verified live amounts instead of reverting to an old local snapshot.
          if (current) data = { ...config, goal: current.goal, raised: current.raised, updatedAt: current.updatedAt, brickLabels: current.brickLabels };
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
