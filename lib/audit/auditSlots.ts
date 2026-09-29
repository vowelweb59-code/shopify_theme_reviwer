// At most MAX_CONCURRENT_AUDITS audits run at once; the rest wait their
// turn. Each audit extracts a ZIP (up to 500 MB unpacked) into /tmp and can
// make dozens of PageSpeed calls, so a burst of uploads on the single
// Render instance could otherwise fill its disk or memory, or burn the PSI
// quota. On globalThis so a dev hot-reload keeps one queue.
const MAX_CONCURRENT_AUDITS = 2;

const g = globalThis as typeof globalThis & { _auditSlots?: { active: number; waiting: (() => void)[] } };
const slots = (g._auditSlots ??= { active: 0, waiting: [] });

export async function withAuditSlot<T>(work: () => Promise<T>): Promise<T> {
  if (slots.active >= MAX_CONCURRENT_AUDITS) {
    await new Promise<void>((resolve) => slots.waiting.push(resolve));
  } else {
    slots.active++;
  }
  try {
    return await work();
  } finally {
    // Hand the slot straight to the next waiter, or free it.
    const next = slots.waiting.shift();
    if (next) next();
    else slots.active--;
  }
}
