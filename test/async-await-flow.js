/* eslint-disable */

const level1 = [];
const level2 = [];

async function mapper(v) {
  level2.push(v);
  return v * 2;
}

async function map(a, b, c) {
  const result = [];
  // this next line will be executed synchronously because it's before
  // any await statements, so level1 will get a, b, c pushed into it
  // before 5 that's pushed in the function go below.
  level1.push(a, b, c);
  const x = mapper(a);
  result.push(await x);
  // because of the await above, the code below will executed
  // async, and level2 will get 5 pushed into it before b and c
  // hence level2 would be [1, 5, 2, 3]
  const y = mapper(b);
  const z = mapper(c);
  result.push(await y, await z);
  return result;
}

async function go() {
  const promise = map(1, 2, 3);
  level1.push(5);
  level2.push(5);
  const r = await promise;
  console.log("level1", level1);
  console.log("level2", level2);
  console.log("result", r);
}

go();
