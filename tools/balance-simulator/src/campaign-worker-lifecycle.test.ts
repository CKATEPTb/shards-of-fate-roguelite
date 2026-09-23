import { describe, expect, it } from 'vitest';
import { CampaignWorkerLifecycle } from './campaign-worker-lifecycle';

describe('campaign worker lifecycle', () => {
  it.each([[0, null], [1, null], [null, 'SIGTERM'], [null, 'SIGKILL']] as const)('rejects unexpected exit %s / %s with work outstanding', (code, signal) => {
    const worker = new CampaignWorkerLifecycle();
    worker.assign(6);
    const error = worker.exitError(code, signal);
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toContain('6 campaigns in flight');
    expect(error!.message).toContain(signal ?? `code ${code}`);
  });
  it('accepts a deliberate retirement after its complete batch was received', () => {
    const worker = new CampaignWorkerLifecycle();
    for (let batch = 0; batch < 8; batch++) { worker.assign(6); worker.receive(6); }
    expect(worker.completed).toBe(48);
    expect(worker.inFlight).toBe(0);
    worker.retire();
    expect(worker.exitError(0, null)).toBeUndefined();
    expect(() => worker.assign(1)).toThrow();
  });
  it('rejects an unsolicited clean exit before the first batch is assigned', () => {
    expect(new CampaignWorkerLifecycle().exitError(0, null)).toBeInstanceOf(Error);
  });
  it('does not discard outstanding jobs through partial results or early retirement', () => {
    const worker = new CampaignWorkerLifecycle();
    worker.assign(6);
    expect(() => worker.assign(1)).toThrow();
    expect(() => worker.receive(5)).toThrow('unexpected batch size');
    expect(() => worker.retire()).toThrow('campaigns in flight');
    expect(worker.inFlight).toBe(6);
    worker.receive(6);
    expect(() => worker.receive(6)).toThrow('unexpected batch size');
  });
});
