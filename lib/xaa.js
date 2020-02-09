"use strict";

const assert = require("assert");

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
    toObj.timerId = setTimeout(() => {
      toObj.reject(new TimeoutError(rejectMsg));
    }, maxMs);
    // clear
    toObj.clear = () => {
      if (toObj.timerId) {
        clearTimeout(toObj.timerId);
        toObj.timerId = null;
      }
    };

    const setError = err => {
      if (err && !toObj.error && !toObj.hasOwnProperty("result")) {
        toObj.error = err;
      }
      return toObj.error;
    };

    toObj.done = (err, res) => {
      toObj.clear();
      if (setError(err)) {
        throw toObj.error;
      }
      if (!toObj.hasOwnProperty("result")) {
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
        r => toObj.done(null, r),
        e => toObj.done(e)
      );
    };

    toObj.cancel = (msg = "operation cancelled") => {
      toObj.clear();
      if (setError(new TimeoutError(msg))) {
        toObj.reject(toObj.error);
      }
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
    const awaited = new Array(array.length);

    const defer = this.defer();

    let error;
    let completedCount = 0;
    let freeSlots = concurrency;
    let index = 0;

    const fail = err => {
      if (error) {
        return undefined;
      }
      err.partial = awaited;
      return defer.reject((error = err));
    };

    const next = async () => {
      if (error || freeSlots <= 0 || index >= array.length) {
        return undefined;
      }

      freeSlots--;
      const pendingIx = index++;

      const save = x => {
        completedCount++;
        freeSlots++;
        awaited[pendingIx] = x;
        if (!error && completedCount === array.length) {
          return defer.resolve(awaited);
        }
        return next();
      };

      try {
        const res = func(array[pendingIx], pendingIx, array);
        if (res.then) {
          res.then(save, fail);
          return next();
        } else {
          return save(res);
        }
      } catch (err) {
        return fail(err);
      }
    };

    next();

    return defer.promise;
  },

  async map(array, func, options = { concurrency: 1 }) {
    assert(Array.isArray(array), `xaa.map expecting an array but got ${typeof array}`);
    if (array.length < 1) {
      return [];
    }
    if (options.concurrency > 1) {
      return await this.multiMap(array, func, options.concurrency);
    } else {
      const awaited = new Array(array.length);

      try {
        for (let i = 0; i < array.length; i++) {
          awaited[i] = await func(array[i], i, array);
        }

        return awaited;
      } catch (err) {
        err.partial = awaited;
        throw err;
      }
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
