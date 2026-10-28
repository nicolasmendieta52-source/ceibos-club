(() => {
  const header = document.getElementById('nav');
  const menu = document.getElementById('navMobile');
  const toggle = document.getElementById('hamb');
  const more = document.getElementById('mobileMore');
  const dock = document.getElementById('mobileDock');
  const desktopGroups = [...header.querySelectorAll('[data-nav-group]')];
  const mobile = matchMedia('(max-width:900px)');
  let opener = toggle;

  // Safari can keep bottom:0 anchored to an old layout viewport while its
  // browser controls expand/collapse. Anchor the dock from the visible bottom.
  // https://bugs.webkit.org/show_bug.cgi?id=312149
  const viewport = window.visualViewport;
  let viewportFrame = 0;
  function updateViewport() {
    viewportFrame = 0;
    const root = document.documentElement;
    // Keep native page zoom behavior; CSS dynamic viewport units are the fallback.
    if (!mobile.matches || !viewport || Math.abs(viewport.scale - 1) > .01) {
      root.style.removeProperty('--nav-viewport-bottom');
      return;
    }
    const bottom = viewport.height + viewport.offsetTop;
    if (!Number.isFinite(bottom) || bottom <= 0) return;
    const value = Math.round(bottom * 100) / 100 + 'px';
    if (root.style.getPropertyValue('--nav-viewport-bottom') !== value) {
      root.style.setProperty('--nav-viewport-bottom', value);
    }
  }
  function requestViewport() {
    if (!viewportFrame) viewportFrame = requestAnimationFrame(updateViewport);
  }
  viewport?.addEventListener('resize', requestViewport, {passive:true});
  viewport?.addEventListener('scroll', requestViewport, {passive:true});
  ['scroll','resize','orientationchange','pageshow'].forEach(event =>
    addEventListener(event, requestViewport, {passive:true}));
  mobile.addEventListener('change', requestViewport);
  updateViewport();

  function setMenu(open, returnFocus = false) {
    open = open && mobile.matches;
    menu.hidden = !open;
    menu.inert = !open;
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    toggle.querySelector('.nav-menu-label').textContent = open ? 'Cerrar' : 'Menú';
    more.setAttribute('aria-expanded', String(open));
    more.setAttribute('aria-label', open ? 'Cerrar menú completo' : 'Abrir menú completo');
    more.querySelector('span').textContent = open ? 'Cerrar' : 'Más';
    document.body.classList.toggle('nav-menu-open', open);
    if (open) menu.querySelector('a')?.focus();
    else if (returnFocus) opener.focus();
  }

  [toggle, more].forEach(button => button.addEventListener('click', () => {
    opener = button;
    setMenu(menu.hidden, !menu.hidden);
  }));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  dock.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  header.querySelector('.brand').addEventListener('click', () => setMenu(false));
  function closeDesktopGroups() {
    desktopGroups.forEach(group => { group.open = false; });
  }
  desktopGroups.forEach(group => {
    group.addEventListener('toggle', () => {
      if (group.open) desktopGroups.filter(other => other !== group).forEach(other => { other.open = false; });
    });
    group.querySelectorAll('a').forEach(link => link.addEventListener('click', closeDesktopGroups));
    group.addEventListener('focusout', event => {
      if (!group.contains(event.relatedTarget)) group.open = false;
    });
  });
  addEventListener('click', event => {
    if (!desktopGroups.some(group => group.contains(event.target))) closeDesktopGroups();
  });
  addEventListener('hashchange', () => { setMenu(false); closeDesktopGroups(); });
  mobile.addEventListener('change', () => { setMenu(false); closeDesktopGroups(); });

  addEventListener('keydown', event => {
    const openGroup = desktopGroups.find(group => group.open);
    if (event.key === 'Escape' && openGroup) {
      event.preventDefault();
      closeDesktopGroups();
      openGroup.querySelector('summary').focus();
    }
    if (menu.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false, true);
    } else if (event.key === 'Tab') {
      const controls = [header.querySelector('.brand'), toggle, ...menu.querySelectorAll('a'), ...dock.querySelectorAll('a,button')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();first.focus();
      }
    }
  });

  // Match anchor offsets to the actual header, including font loading and device changes.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--nav-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }).observe(header);

  const sectionLinks = [...document.querySelectorAll('[data-nav-section]')];
  let scrollFrame = 0;
  function updateCurrent() {
    scrollFrame = 0;
    const top = header.getBoundingClientRect().height + 35;
    let current = 'inicio';
    const sections = [...document.querySelectorAll('section[id],header[id],.dep-panel[id]')]
      .filter(section => section.id !== 'nav');
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.height > 0 && rect.top <= top && rect.bottom > top) current = section.id;
    }
    sectionLinks.forEach(link => {
      const active = link.dataset.navSection === current;
      link.classList.toggle('activo', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    desktopGroups.forEach(group => group.classList.toggle('activo', Boolean(group.querySelector('a.activo'))));
    dock.querySelectorAll('a').forEach(link => {
      const target = link.getAttribute('href').slice(1);
      const active = current === target || (target === 'deportes' && ['rugby','hockey','futbol','basketball','archivo','resultados','fixture'].includes(current));
      link.classList.toggle('activo', active);
      if (active) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  function requestCurrent() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateCurrent); }
  addEventListener('scroll', requestCurrent, {passive:true});
  addEventListener('resize', requestCurrent, {passive:true});
  addEventListener('hashchange', requestCurrent);
  addEventListener('load', requestCurrent, {once:true});
  setMenu(false);
  requestCurrent();
})();
