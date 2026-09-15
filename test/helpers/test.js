/** Queue + runner so `npm test` works on Node 16 (no `node:test`). */

const queue = [];

function forbidden(kind) {
  return function forbiddenTest() {
    throw new Error(
      `test.${kind} is forbidden. Remove it so Node 16 and CI run the full suite.`,
    );
  };
}

/**
 * @param {string} name
 * @param {() => unknown | Promise<unknown>} fn
 */
export function test(name, fn) {
  queue.push({ name, fn });
}

test.only = forbidden("only");
test.skip = forbidden("skip");
test.todo = forbidden("todo");

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
  return failed;
}
