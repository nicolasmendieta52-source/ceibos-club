// Keep the WhatsApp contact available unless an official registration form is configured.
fetch('data/interno.json?actualizado=' + Date.now(), {cache:'no-store'})
  .then(response => response.ok ? response.json() : null)
  .then(data => {
    if (!data?.registrationOpen || typeof data.registrationUrl !== 'string') return;
    const url = new URL(data.registrationUrl);
    if (url.protocol !== 'https:') return;
    const button = document.getElementById('interno-inscripcion');
    if (!button) return;
    const link = document.createElement('a');
    link.className = button.className;
    link.id = button.id;
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Inscribirme al Interno ↗';
    button.replaceWith(link);
    document.getElementById('interno-inscripcion-estado').textContent = 'Inscripciones abiertas';
    document.getElementById('interno-inscripcion-texto').textContent = 'Completá el formulario oficial para anotarte al Interno.';
  }).catch(() => {}); // Preserve the WhatsApp contact if the form configuration is unavailable.

// Instagram reports the embed's height as its media and controls finish loading.
// Accept measurements only from an Instagram frame actually rendered in this section.
window.addEventListener('message', event => {
  if (event.origin !== 'https://www.instagram.com') return;
  const frame = [...document.querySelectorAll('#interno .interno-instagram')]
    .find(element => element.contentWindow === event.source);
  if (!frame) return;
  let message = event.data;
  if (typeof message === 'string') {
    try { message = JSON.parse(message); } catch { return; }
  }
  const height = Number(message?.details?.height);
  if (message?.type !== 'MEASURE' || !Number.isFinite(height) || height < 250 || height > 1800) return;
  frame.style.height = Math.ceil(height) + 'px';
});
