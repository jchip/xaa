import * as assert from "assert";

interface Run<T> {
  (tasks: Promise<T>): Promise<T>;
  (tasks: Promise<T>[]): Promise<T[]>;
}

interface RunThing<T> {
  run: Run<T>;
}

/**
 * Defer object for fulfilling a promise later in other events
 *
 * To use, use `xaa.makeDefer` or its alias `xaa.defeer`.
 *
 */
export class Defer<T> {
  /**
   * construct Defer
   *
   * @param Promise optional promise constructor
   */
  constructor(Promise: PromiseConstructor = global.Promise) {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  /** The promise object for the defer */
  promise: Promise<T>;
  /** resolve the defered promise */
  resolve: (result?: T) => void;
  /** reject the deferred promise */
  reject: (reason?: any) => void;
  /**
   * node.js callback for the deferred promise
   *
   * @param err - error
   * @param args - result
   */
  done(err: Error, ...args: any[]) {
    // Not declaring (err, result) explicitly for standard node.js callback.
    // we can't be sure if user's API expects callback that
    // should have a second arg for result.
    if (err) this.reject(err);
    else this.resolve(args[0]);
  }
}

/**
 * Create a promise Defer object
 *
 * Sample:
 *
 * ```js
 * async function waitEvent() {
 *   const defer = xaa.makeDefer();
 *   someThing.on("event", (data) => defer.resolve(data))
 *   return defer.promise;
 * }
 * ```
 *
 * @param Promise - optional Promise constructor.
 * @returns Defer instance
 */
export function makeDefer<T>(Promise: PromiseConstructor = global.Promise): Defer<T> {
  return new Defer(Promise);
}

export { makeDefer as defer };

/**
 * The error xaa.timeout will throw if operation timed out
 */
export class TimeoutError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "TimeoutError";
    assert(msg);
  }
}

/**
 * delay some milliseconds and then return `valOrFunc`
 *
 * Sample:
 *
 * ```js
 * await xaa.delay(500);
 * ```
 *
 * @param delayMs - number milliseconds to delay
 * @param valOrFunc - the value to return.  If it's a function, call it to get the value.
 * It can be an async function.
 * @returns `valOrFunc` or its returned value if it's a function.
 */
type Consumer<T> = (item: T, index?: number) => unknown;
type Producer<T> = () => (T | Promise<T>);
type Predicate<T> = (item: T, index?: number) => boolean;
type ValueOrProducer<T> = T | Promise<T> | Producer<T>;
type ValueOrFunctionConsumingError<T> = T | Promise<T> | ((err?: Error) => T);

export async function delay<T>(delayMs: number, valOrFunc?: ValueOrProducer<T>): Promise<T> {
  let handler: (resolve: any) => NodeJS.Timeout;

  const c = valOrFunc && valOrFunc.constructor.name;

  if (c === "AsyncFunction") {
    handler = (resolve: (res: any) => any) =>
      setTimeout(async () => resolve(await (valOrFunc as Function)()), delayMs);
  } else if (c === "Function") {
    handler = (resolve: (res: any) => any) => setTimeout(() => resolve((valOrFunc as Function)()), delayMs);
  } else {
    handler = (resolve: (res: any) => any) => setTimeout(() => resolve(valOrFunc), delayMs);
  }

  return new Promise(handler);
}

/**
 * TimeoutRunner for running tasks (promises) with a timeout
 *
 * Please use `xaa.timeout` or `xaa.runTimeout` APIs instead.
 */
export class TimeoutRunner<T> implements RunThing<T> {
  constructor(maxMs: number, rejectMsg: string) {
    this.maxMs = maxMs;
    this.rejectMsg = rejectMsg;
    this.defer = makeDefer();
    this.timeout = setTimeout(() => this.defer.reject(new TimeoutError(rejectMsg)), maxMs);
  }
  private defer: Defer<T>;
  /** setTimeout handle */
  private timeout: NodeJS.Timeout;
  /**
   * check if runner has failed with error
   *
   * @returns has error flag
   */
  hasError(): boolean {
    return this.hasOwnProperty("error");
  }

  /**
   * check if runner has finished with result
   *
   * @returns has result flag
   */
  hasResult(): boolean {
    return this.hasOwnProperty("result");
  }

  /**
   * Run tasks
   *
   * @param tasks - Promise or function that returns Promise, or array of them.
   * @returns Promise to wait for tasks to complete, or timeout error.
   */
  async run(tasks) {
    const process = async (x: any) => (typeof x === "function" ? x() : x);
    let arrTasks: Promise<any>;
    if (!Array.isArray(tasks)) {
      arrTasks = process(tasks);
    } else {
      arrTasks = Promise.all(tasks.map(process));
    }
    try {
      const r = await Promise.race([arrTasks, this.defer.promise]);
      this.clear();
      this.result = r;
      return r;
    } catch (err) {
      this.clear();
      this.error = err;
      throw err;
    }
  }

  /**
   * Cancel the operation and reject with msg
   *
   * @param msg - cancel message
   */
  cancel(msg: string = "xaa TimeoutRunner operation cancelled"): void {
    this.clear();
    this.defer.reject(new TimeoutError(msg));
  }

  /** Explicitly clear the setTimeout handle */
  clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  /**
   * Check if runner is done
   *
   * @returns is done flag
   */
  isDone(): boolean {
    return this.hasResult() || this.hasError();
  }

  /** number of milliseconds to allow tasks to run */
  maxMs: number;
  /** message to reject with if operation timed out */
  rejectMsg: string;
  /** the error if running failed */
  error?: Error;
  /** the result from running tasks */
  result?: T;
}

/**
 * Create a TimeoutRunner to run tasks (promises) with timeout
 *
 * Sample:
 *
 * ```js
 * await xaa.timeout(1000, "timeout fetching data").run(() => fetch(url))
 * ```
 *
 * with promises:
 *
 * ```js
 * await xaa.timout(1000).run([promise1, promise2])
 * ```
 *
 * @param maxMs - number of milliseconds to allow tasks to run
 * @param rejectMsg - message to reject with when timeout triggers
 * @returns TimeoutRunner object
 */
export function timeout<T>(
  maxMs: number,
  rejectMsg: string = "xaa TimeoutRunner operation timed out"
): TimeoutRunner<T> {
  return new TimeoutRunner(maxMs, rejectMsg);
}

/**
 * Calls `timeout(maxMs, rejectMsg).run(tasks)`
 *
 * @param tasks - Promise or function or array of them
 * @param maxMs - milliseconds to wait for the tasks to fulfill
 * @param rejectMsg - message to reject with if operation timed out
 * @returns promise results from all tasks
 */
export async function runTimeout<T>(tasks: Promise<T> | Promise<T>[], maxMs: number, rejectMsg?) {
  return await timeout(maxMs, rejectMsg).run(tasks);
}

/**
 * The error xaa.map will throw if something went wrong.
 *
 * Contains a partial field for result mapped before error was encountered.
 */
export class MapError extends Error {
  /** the result that has been mapped before error was encountered */
  partial: any[];
}

/** options for xaa.map */
export type MapOptions = {
  /** number of items to map concurrently */
  concurrency: number;
  /** the this passed to the map callback */
  thisArg?: any;
};

/** context from xaa.map to the mapper callback */
export type MapContext = {
  /**
   * indicate if another map operation during concurrent map has failed
   * Mapping should observe this flag whenever possible and avoid continuing
   * if it makes sense.
   */
  failed?: boolean;
  /**
   * the original array that's passed to xaa.map
   */
  array: any[];
};

/**
 * callback function for xaa.map to map the value.
 *
 * @param value value to map
 * @param index index of the value in the array
 * @param context MapContext
 * @returns any or a promise
 */
export type MapFunction<T, O> = (value: T, index: number, context: MapContext) => O | Promise<O>;

/**
 * async map for array that supports concurrency
 *
 * Use by xaa.map internally.
 *
 * @param array array to map
 * @param func mapper callback
 * @param options MapOptions
 * @returns promise with mapped result
 */
function multiMap<T, O>(array: T[], func: MapFunction<T, O>, options: MapOptions): Promise<O[]> {
  const awaited = new Array<O>(array.length);

  let error: MapError;
  let completedCount = 0;
  let freeSlots = options.concurrency;
  let index = 0;

  const context: MapContext = { array };

  const defer = makeDefer<O[]>();

  const fail = (err: Error): void => {
    context.failed = true;
    if (!error) {
      error = err as MapError;
      error.partial = awaited;
      defer.reject(error);
    }
  };

  const mapNext = (): void => {
    // important to check this here, so an empty input array immediately
    // gets resolved with an empty result.
    if (!error && completedCount === array.length) {
      defer.resolve(awaited);
      return;
    }

    if (error || freeSlots <= 0 || index >= array.length) {
      return;
    }

    freeSlots--;
    const pendingIx = index++;

    const save = (x: any) => {
      completedCount++;
      freeSlots++;
      awaited[pendingIx] = x;
      mapNext();
    };

    try {
      const res = func.call(options.thisArg, array[pendingIx], pendingIx, context);
      if (res && res.then) {
        res.then(save, fail);
        mapNext();
      } else {
        save(res);
      }
    } catch (err) {
      fail(err);
    }
  };

  //
  // Should not use setTimeout for next:
  //
  // Top level code in async functions before any await statements, execute synchronously.
  //
  // Similar to that setting up promises is sync, and then the
  // fulfilment of them is async, meaning their .then are called.
  //
  mapNext();

  return defer.promise;
}

/**
 * async map array with concurrency
 * - intended to be similar to `bluebird.map`
 *
 * @param array - input array for map
 * @param func - callback to map values from the array
 * @param options - MapOptions
 * @returns promise with mapped result
 */
export async function map<T, O>(
  array: T[],
  func: MapFunction<T, O>,
  options: MapOptions = { concurrency: 1 }
): Promise<O[]> {
  assert(Array.isArray(array), `xaa.map expecting an array but got ${typeof array}`);
  if (array.length < 1) {
    return [];
  }
  if (options.concurrency > 1) {
    return multiMap(array, func, options);
  } else {
    const awaited = new Array(array.length);

    const context: MapContext = { array, failed: false };

    try {
      for (let i = 0; i < array.length; i++) {
        awaited[i] = await func.call(options.thisArg, array[i], i, context);
      }

      return awaited;
    } catch (err) {
      (err as MapError).partial = awaited;
      throw err;
    }
  }
}

/**
 * async version of array.forEach
 * - iterate through array and await call func with each element and index
 *
 * Sample:
 *
 * ```js
 * await xaa.each([1, 2, 3], async val => await xaa.delay(val))
 * ```
 *
 * @param array array to each
 * @param func callback for each
 */
export async function each<T>(array: T[], func: Consumer<T>) {
  for (let i = 0; i < array.length; i++) {
    await func(array[i], i);
  }
}

/**
 * async filter array
 *
 * Sample:
 *
 * ```js
 * await xaa.filter([1, 2, 3], async val => await validateResult(val))
 * ```
 *
 * @param array array to filter
 * @param func callback for filter
 * @returns filtered result
 */
export async function filter<T>(array: T[], func: Predicate<T>) {
  const filtered = [];

  for (let i = 0; i < array.length; i++) {
    const x = await func(array[i], i);

    if (x) filtered.push(array[i]);
  }

  return filtered;
}

/**
 * try to call and await a function and if it throws, then return `valOrFunc`.
 *
 * - if `valOrFunc` is a function, then return `await valOrFunc(err)`
 *
 * @param func function to try
 * @param valOrFunc value, or callback to get value, to return if `func` throws
 * @returns awaited result, `valOrFunc`, or `await valOrFunc(err)`.
 */
export async function tryCatch<T, TAlt>(func: () => T,
  valOrFunc: ValueOrFunctionConsumingError<TAlt>): Promise<T | TAlt> {
    try {
      const r = func();
      return await r;
    } catch (err) {
      if (typeof valOrFunc === "function") {
        const r = (valOrFunc as Function)(err);
        return await r;
      }

      return valOrFunc;
    }
}

export { tryCatch as try };

/**
 * Wrap the calling of a function into async/await (promise) context
 * - intended to be similar to `bluebird.try`
 *
 * @param func function to wrap in async context
 * @param args arguments to pass to `func`
 * @returns result from `func`
 */
export async function wrap<T, F extends (...args: any[]) => T>
    (func: F, ...args: Parameters<F>): Promise<T> {
  return await func(...args);
}
