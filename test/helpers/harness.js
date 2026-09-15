/** Minimal test runner so `npm test` works on Node 16 (no `node:test`). */

const queue = [];

/**
 * @param {string} name
 * @param {() => unknown | Promise<unknown>} fn
 */
export default function test(name, fn) {
  queue.push({ name, fn });
}

export async function run() {
  let failed = 0;
  for (const { name, fn } of queue) {
    try {
      await fn();
      console.log(`✔ ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`✖ ${name}`);
      console.error(err);
    }
  }
  const passed = queue.length - failed;
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
