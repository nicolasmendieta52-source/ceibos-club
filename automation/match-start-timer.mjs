// Timers run independently of fixture refreshes, so an HTTP request at kickoff cannot delay them.
export class MatchStartTimer {
  constructor({prepare, send, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, onError = console.error}) {
    Object.assign(this, {prepare, send, now, setTimer, clearTimer, onError});
    this.jobs = new Map();
    this.finished = new Map();
  }

  reconcile(plans) {
    const next = new Map(plans.map(plan => [plan.id, plan]));
    for (const [id, job] of this.jobs) {
      if (job.sending) continue;
      const plan = next.get(id);
      if (!plan || this.fingerprint(plan) !== job.fingerprint) this.remove(id);
    }
    for (const plan of plans) {
      if (this.jobs.has(plan.id) || this.finished.get(plan.id) === this.fingerprint(plan)) continue;
      const job = {...plan, fingerprint:this.fingerprint(plan)};
      this.jobs.set(plan.id, job);
      job.prepareTimer = this.at(plan.preparar, () => this.preload(job));
      job.sendTimer = this.at(plan.inicio, () => this.dispatch(job));
    }
  }

  fingerprint(plan) { return JSON.stringify(plan.partidos); }
  current(job) { return this.jobs.get(job.id) === job; }
  at(deadline, action) {
    return this.setTimer(() => Promise.resolve().then(action).catch(this.onError), Math.max(0, deadline - this.now()));
  }

  preload(job) {
    if (!this.current(job)) return Promise.resolve(null);
    if (!job.prepared) {
      job.prepared = Promise.resolve().then(() => this.prepare(job)).catch(error => {
        job.prepared = null;
        throw error;
      });
    }
    return job.prepared;
  }

  async dispatch(job) {
    if (!this.current(job) || job.sending || job.dispatching) return;
    // A clock correction must never cause an early notification.
    if (this.now() < job.inicio) {
      job.sendTimer = this.at(job.inicio, () => this.dispatch(job));
      return;
    }
    job.dispatching = true;
    try {
      const prepared = await this.preload(job);
      if (!this.current(job)) return;
      job.sending = true;
      await this.send(job, prepared);
      this.finished.set(job.id, job.fingerprint);
      this.remove(job.id);
    } catch (error) {
      job.sending = false;
      this.onError(error);
      // Retry transport failures without moving the scheduled kickoff or notifying early.
      job.sendTimer = this.at(this.now() + 30_000, () => this.dispatch(job));
    } finally {
      job.dispatching = false;
    }
  }

  remove(id) {
    const job = this.jobs.get(id);
    if (!job) return;
    this.clearTimer(job.prepareTimer);
    this.clearTimer(job.sendTimer);
    this.jobs.delete(id);
  }

  stop() { for (const id of this.jobs.keys()) this.remove(id); }
}
