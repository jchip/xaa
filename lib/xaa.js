"use strict";

class TimeoutError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "TimeoutError";
  }
}

module.exports = {
  TimeoutError,

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

  async runTimeout(tasks, maxMs, rejectMsg) {
    return await this.timeout(maxMs, rejectMsg).run(tasks);
  },

  timeout(maxMs, rejectMsg = "operation timed out") {
    const toObj = this.defer();
    toObj.maxMs = maxMs;
    toObj.rejectMsg = rejectMsg;
    toObj.id = setTimeout(() => {
      toObj.reject(new TimeoutError(rejectMsg));
    }, maxMs);
    // clear
    toObj.clear = (err, res) => {
      if (toObj.id) {
        clearTimeout(toObj.id);
        toObj.id = null;
      }
      if (err && !toObj.error && !toObj.result) toObj.error = err;
      if (toObj.error) throw toObj.error;
      if (!toObj.result) {
        toObj.result = res;
        toObj.resolve(res);
      }
      return toObj.result;
    };
    // run
    toObj.run = tasks => {
      const process = x => (typeof x === "function" ? x() : x);
      if (!Array.isArray(tasks)) {
        tasks = process(tasks);
      } else {
        tasks = Promise.all(tasks.map(process));
      }
      return Promise.race([tasks, toObj.promise]).then(
        r => toObj.clear(null, r),
        e => toObj.clear(e)
      );
    };
    return toObj;
  },

  defer(Promise = global.Promise) {
    const defer = {};
    defer.promise = new Promise((resolve, reject) => {
      defer.resolve = resolve;
      defer.reject = reject;
    });
    return defer;
  },

  async each(array, func) {
    for (let i = 0; i < array.length; i++) {
      await func(array[i], i);
    }

    return undefined;
  },

  multiMap(array, func, concurrency) {
    const awaited = [];

    const defer = this.defer();

    let completedCount = 0;
    let freeSlots = concurrency;
    let index = 0;
    let next; // eslint-disable-line

    const check = () => {
      if (completedCount === array.length) {
        defer.resolve(awaited);
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
              return defer.reject(err);
            });
        } else {
          completedCount++;
          freeSlots++;
          awaited.push(res);
        }
      } catch (err) {
        return defer.reject(err);
      }

      return check();
    };

    check();

    return defer.promise;
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
      return await r;
    } catch (err) {
      if (typeof valOrFunc === "function") {
        const r = valOrFunc(err);
        return await r;
      }

      return valOrFunc;
    }
  },

  async wrap(func, ...args) {
    return await func(...args);
  }
};
