/** Track IPC work separately from process exit codes: even exit(0) can lose a batch. */
export class CampaignWorkerLifecycle {
  inFlight = 0;
  completed = 0;
  expectedExit = false;

  assign(count: number): void {
    if (!Number.isInteger(count) || count <= 0 || this.inFlight || this.expectedExit) throw new Error('Cannot assign this simulation worker');
    this.inFlight = count;
  }

  receive(count: number): void {
    if (!this.inFlight || count !== this.inFlight || this.expectedExit) throw new Error('Simulation worker returned an unexpected batch size');
    this.completed += count;
    this.inFlight = 0;
  }

  retire(): void {
    if (this.inFlight) throw new Error('Cannot retire a simulation worker with campaigns in flight');
    this.expectedExit = true;
  }

  exitError(code: number | null, signal: string | null): Error | undefined {
    if (this.expectedExit && !this.inFlight) return undefined;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
    return new Error(`Simulation worker exited unexpectedly (${reason}); ${this.inFlight} campaigns in flight`);
  }
}
