const COUNT = 60;
const cents = n => Math.round(n * 100);
const validAmount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;

// Only this explicit allowlist is written to the public site. Never export ledger rows.
export function campaignFromLedger(summary, rows, sponsors = []) {
  if (summary?.length !== 7 || summary[1]?.[0] !== 'Meta (USD)' || summary[5]?.[0] !== 'Saldo inicial (USD)') throw new Error('Resumen inesperado');
  const goal = summary[1][1], opening = summary[5][1], reported = summary[0][1];
  if (!validAmount(goal) || !goal || !validAmount(opening) || !validAmount(reported) || summary[4]?.[1] !== COUNT) throw new Error('Totales inválidos');
  const headers = ['Ladrillo','Nombre público','Objetivo USD','Pagado USD','Estado','Incluido en saldo inicial','Fecha del pago','Notas privadas','Tipo'];
  if (!headers.every((h,i)=>rows?.[0]?.[i]===h) || rows.length !== COUNT+1) throw new Error('La planilla debe tener 60 ladrillos y las columnas esperadas');
  const brickLabels=Array(COUNT).fill(''), brickSponsors=Array(COUNT).fill(false), brickProgress=Array(COUNT).fill(0);
  const brickSizes=Array(COUNT).fill(1);
  const seen=new Set(); let total=cents(opening);
  const sponsorNames = [];
  const addSponsor = name => {
    if (typeof name !== 'string' || name.length > 160 || /^#(REF!|VALUE!|ERROR!|N\/A)/.test(name)) throw new Error('Nombre de sponsor inválido');
    const trimmed = name.trim();
    if (trimmed && !sponsorNames.some(n => n.toLocaleLowerCase('es-UY') === trimmed.toLocaleLowerCase('es-UY'))) sponsorNames.push(trimmed);
  };
  sponsors.forEach(entry => addSponsor(entry?.[0] ?? ''));
  const aggregate = row => row[8] === 'Sponsor' && /^sponsors$/i.test((row[1] || '').trim()) && sponsors.some(entry => entry?.[0]?.trim());
  for (const row of rows.slice(1)) {
    const [id,name='',target,paid='',state,included,,,type]=row;
    if (!Number.isInteger(id)||id<1||id>COUNT||seen.has(id)) throw new Error('Numeración inválida o duplicada');
    seen.add(id);
    if (typeof name!=='string'||name.length>160||/^#(REF!|VALUE!|ERROR!|N\/A)/.test(name)) throw new Error(`Nombre inválido en ladrillo ${id}`);
    if (!['Sí','No'].includes(included)||!['Aportante','Sponsor'].includes(type)) throw new Error(`Clasificación inválida en ladrillo ${id}`);
    if (paid!==''&&!validAmount(paid)) throw new Error(`Pago inválido en ladrillo ${id}`);
    if (included==='No'&&paid!=='') total+=cents(paid);
    // A collective sponsor payment counts once; the Sponsors tab supplies company identities.
    if (aggregate(row)) continue;
    if (type === 'Sponsor') { addSponsor(name); continue; }
    const hasPayment=included==='Sí'||paid>0;
    const publicName = /^(?:Individual|Plan Familiar)\s*\(/i.test(name) ? 'Aportante' : name.trim();
    brickLabels[id-1]=hasPayment?publicName.replace(/ y flia$/, '\ny flia'):'';
    if (hasPayment) {
      // Publish only a visual tier, never individual payments or private notes.
      brickSizes[id-1]=paid>=2000?3:paid>=1000?2:1;
      if (!validAmount(target)||!target) throw new Error(`Falta objetivo en ladrillo ${id}`);
      brickProgress[id-1]=included==='Sí'&&paid===''?1:Math.min(paid/target,1);
    }
  }
  if (total!==cents(reported)) throw new Error('El total calculado no coincide con el resumen');
  return {goal,raised:total/100,brickLabels,brickSponsors,brickProgress,brickSizes,sponsors:sponsorNames};
}
