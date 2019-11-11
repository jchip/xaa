# xaa

async/await and Promise helpers.

- `async xaa.delay(ms, [val|valFunc])`

  - wait `ms` milliseconds and then return `val` or returned value of calling `valFunc`.

- `xaa.defer([Promise = global.Promise])`

  - Return `{promise, resolve, reject}`

- `xaa.TimeoutError` - error thrown by `xaa.timeout` on time out.

  - `new TimeoutError(msg)`

- `async xaa.runTimeout(tasks, maxMs, rejectMsg)`

  - shortcut for:

  ```js
  return await xaa.timeout(maxMs, rejectMsg).run(tasks);
  ```

- `xaa.timeout(maxMs, rejectMsg = "operation timed out")`

  - Return `{maxMs, rejectMsg, run, promise, resolve, reject, clear, id}`

  - `maxMs`, `rejectMsg` - max time in milli seconds to wait before throwing `new TimeoutError(rejectMsg)`
  - `run(tasks)` - function to run tasks that are subjected to the timeout. `tasks` can be a single or an array of Promise, function, or any value.
  - `promise`, `resolve`, `reject` - promise to wait for timeout and its `resolve` and `reject` callbacks.
  - `clear` - function `clear(err, result)` to end the timeout. re-entrant.
  - `id` - `setTimeout` id

  Examples:

  ```js
  // will throw TimeoutError
  await xaa.timeout(50, "took too long").run(xaa.delay(100));
  // will run the two functions and wait for them
  await xaa
    .timeout(50, "oops")
    .run([
      () => xaa.delay(10, 1),
      () => xaa.delay(15, 2),
      "some value",
      Promise.resolve("more value")
    ])
    .then(results => {
      // results === [1, 2, "some value", "more value"]
    });
  ```

* `async xaa.each(array, iterFunc)`

  - await calling `iterFunc` with each `(element, index)` from array

- `async xaa.map(array, func, [{concurrency}])`

  - map array to the awaited value of calling `func` with each `(element, index)`.

- `async xaa.filter(array, func)`

  - filter array by the awaited value of calling `func` with each `(element, index)`

- `async xaa.try(func, [defaultVal|defaultFunc])`

  - call `func` with try/catch, if caught, then return `defaultVal` or the returned value of `defaultFunc`

- `async xaa.wrap(func, ...args)`

  - wrap a call to `func` with `async/await`, passing in `...args`

---
