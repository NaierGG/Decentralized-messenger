class ReconnectionManager {
  constructor({baseDelayMs = 1000, jitterMs = 250, maxAttempts = 5} = {}) {
    this.baseDelayMs = baseDelayMs;
    this.jitterMs = jitterMs;
    this.maxAttempts = maxAttempts;
    this.attemptsByPeer = new Map();
    this.timersByPeer = new Map();
  }

  getAttempts(peerId) {
    return this.attemptsByPeer.get(peerId) || 0;
  }

  reset(peerId) {
    const timer = this.timersByPeer.get(peerId);
    if (timer) {
      clearTimeout(timer);
    }
    this.timersByPeer.delete(peerId);
    this.attemptsByPeer.delete(peerId);
  }

  clearAll() {
    for (const timer of this.timersByPeer.values()) {
      clearTimeout(timer);
    }
    this.timersByPeer.clear();
    this.attemptsByPeer.clear();
  }

  schedule(peerId, task) {
    if (!peerId || typeof task !== 'function') {
      return false;
    }
    if (this.timersByPeer.has(peerId)) {
      return false;
    }

    const currentAttempts = this.getAttempts(peerId);
    if (currentAttempts >= this.maxAttempts) {
      return false;
    }

    const nextAttempt = currentAttempts + 1;
    const delayMs =
      this.baseDelayMs * 2 ** (nextAttempt - 1) +
      Math.floor(Math.random() * this.jitterMs);

    const timer = setTimeout(async () => {
      this.timersByPeer.delete(peerId);
      this.attemptsByPeer.set(peerId, nextAttempt);

      let shouldRetry = false;
      try {
        shouldRetry = Boolean(
          await task({
            peerId,
            attempt: nextAttempt,
            maxAttempts: this.maxAttempts,
            delayMs
          })
        );
      } catch (error) {
        shouldRetry = true;
      }

      if (shouldRetry && this.getAttempts(peerId) < this.maxAttempts) {
        this.schedule(peerId, task);
      }
    }, delayMs);

    this.timersByPeer.set(peerId, timer);
    return true;
  }
}

export default ReconnectionManager;
