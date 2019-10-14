"use strict";

module.exports = {
  async delay(delayMs, valOrFunc) {
    let handler;

    const c = valOrFunc && valOrFunc.constructor.name;

    if (c === "AsyncFunction") {
      handler = resolve => setTimeout(async () => resolve(await valOrFunc()), delayMs);
    } else if (c === "Function") {
      handler = resolve => setTimeout(() => resolve(valOrFunc()), delayMs);
    } else {
      handler = resolve => setTimeout(() => resolve(valOrFunc), delayMs);
    }

    return new Promise(handler);
  },

  async each(array, func) {
    for (let i = 0; i < array.length; i++) {
      await func(array[i], i);
    }

    return undefined;
  },

  multiMap(array, func, concurrency) {
    const awaited = [];

    let dResolve;
    let dReject;
    const promise = new Promise((resolve, reject) => {
      dResolve = resolve;
      dReject = reject;
    });

    let completedCount = 0;
    let freeSlots = concurrency;
    let index = 0;
    let next; // eslint-disable-line

    const check = () => {
      if (completedCount === array.length) {
        dResolve(awaited);
      } else if (freeSlots > 0 && index < array.length) {
        return next();
      }
      return undefined;
    };

    next = () => {
      freeSlots--;
      const pendingIx = index++;
      try {
        const res = func(array[pendingIx], pendingIx);
        if (res.then) {
          awaited.push(undefined);
          res
            .then(x => {
              completedCount++;
              freeSlots++;
              awaited[pendingIx] = x;
              return check();
            })
            .catch(err => {
              err.partial = awaited;
              return dReject(err);
            });
        } else {
          completedCount++;
          freeSlots++;
          awaited.push(res);
        }
      } catch (err) {
        return dReject(err);
      }

      return check();
    };

    check();

    return promise;
  },

  async map(array, func, options = { concurrency: 1 }) {
    if (options.concurrency > 1) {
      return await this.multiMap(array, func, options.concurrency);
    } else {
      const awaited = [];

      for (let i = 0; i < array.length; i++) {
        awaited.push(await func(array[i], i));
      }
      return awaited;
    }
  },

  async filter(array, func) {
    const filtered = [];

    for (let i = 0; i < array.length; i++) {
      const x = await func(array[i], i);

      if (x) filtered.push(array[i]);
    }

    return filtered;
  },

  async try(func, valOrFunc) {
    try {
      const r = func();
      if (r.then) return await r;
      return r;
    } catch (err) {
      if (typeof valOrFunc === "function") {
        const r = valOrFunc(err);
        if (r.then) return await r;
        return r;
      }

      return valOrFunc;
    }
  }
};
