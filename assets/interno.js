// Only activate registration once the club confirms the current event's form.
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
  }).catch(() => {}); // Keep the honest Soon state if the configuration is unavailable.
