"use strict";

const xaa = require("xaa");

/*
 * Demo of xaa async/await helpers
 *
 * Features demonstrated:
 *   - delay: wait for specified milliseconds
 *   - defer: create a promise that can be resolved later
 *   - map: async map with concurrency control
 *   - each: async forEach in series
 *   - timeout: run tasks with timeout
 */

async function main() {
  console.log("=== xaa CommonJS Demo ===\n");

  // delay demo
  console.log("1. delay - waiting 100ms...");
  const start = Date.now();
  await xaa.delay(100);
  console.log(`   Done in ${Date.now() - start}ms\n`);

  // delay with value
  console.log("2. delay with callback...");
  const result = await xaa.delay(50, () => "hello from delay");
  console.log(`   Result: "${result}"\n`);

  // defer demo
  console.log("3. defer - resolve later...");
  const defer = xaa.defer();
  setTimeout(() => defer.resolve("resolved!"), 50);
  const deferResult = await defer.promise;
  console.log(`   Defer result: "${deferResult}"\n`);

  // map demo with concurrency
  console.log("4. map with concurrency 2...");
  const items = [1, 2, 3, 4, 5];
  const mapped = await xaa.map(
    items,
    async (v, i) => {
      await xaa.delay(50);
      return v * 2;
    },
    { concurrency: 2 }
  );
  console.log(`   Input:  [${items.join(", ")}]`);
  console.log(`   Output: [${mapped.join(", ")}]\n`);

  // each demo
  console.log("5. each - iterate in series...");
  const collected = [];
  await xaa.each([10, 20, 30], async v => {
    await xaa.delay(30);
    collected.push(v);
  });
  console.log(`   Collected: [${collected.join(", ")}]\n`);

  // timeout demo
  console.log("6. timeout - run with timeout...");
  const timeoutResult = await xaa.timeout(500, "timed out").run(xaa.delay(100, "success"));
  console.log(`   Result: "${timeoutResult}"\n`);

  console.log("=== Demo Complete ===");
}

main().catch(console.error);
