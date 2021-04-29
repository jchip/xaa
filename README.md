# xaa

async/await and Promise helpers.

github: <https://github.com/jchip/xaa>

## Install and Usage

```
npm i xaa
```

## APIs

API references <https://jchip.github.io/xaa/>

Or just use your IDE for hint if it supports TypeScript and typedoc.

## Examples:

### xaa.timeout

```js
import { timeout } from "xaa";

async function test() {
  // will throw TimeoutError
  await timeout(50, "took too long").run(xaa.delay(100));
  // will run the two functions and wait for them
  await timeout(50, "oops")
    .run([
      () => xaa.delay(10, 1),
      () => xaa.delay(15, 2),
      "some value",
      Promise.resolve("more value")
    ])
    .then(results => {
      // results === [1, 2, "some value", "more value"]
    });
}
```

### xaa.map

```js
import { map } from xaa;

async function test() {
  return await map(
    ["http://url1", "http://url2"],
    async url => fetch(url),
    { concurrency: 2 }
  );
}
```

# License

Licensed under the [Apache License, Version 2.0].

[apache license, version 2.0]: https://www.apache.org/licenses/LICENSE-2.0
