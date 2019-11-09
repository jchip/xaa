# xaa

Some helpers for await/async.

- `async xaa.delay(ms, [val|valFunc])`

  - wait `ms` milliseconds and then return `val` or returned value of calling `valFunc`.

- `async xaa.each(array, iterFunc)`

  - await calling `iterFunc` with each `(element, index)` from array

- `async xaa.map(array, func, [{concurrency}])`

  - map array to the awaited value of calling `func` with each `(element, index)`.

- `async xaa.filter(array, func)`

  - filter array by the awaited value of calling `func` with each `(element, index)`

- `async xaa.try(func, [defaultVal|defaultFunc])`

  - call `func` with try/catch, if caught, then return `defaultVal` or the returned value of `defaultFunc`

- `async xaa.wrap(func, ...args)`

  - wrap a call to `func` with `awayc/await`, passing in `...args`

---
