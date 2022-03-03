/* eslint-disable */

import * as xaa from "../../src";
import { asyncVerify, expectError } from "run-verify";
import { expect } from "chai";

describe("xaa", function () {
  describe("delay", function () {
    it("should wait ms", async () => {
      const a = Date.now();
      const x = await xaa.delay(20);
      expect(x).to.equal(undefined);
      expect(Date.now() - a).to.be.above(19);
    });

    it("should wait and run async func", async () => {
      const a = Date.now();
      const x = await xaa.delay(20, async () => "hello");
      expect(x).to.equal("hello");
      expect(Date.now() - a).to.be.above(19);
    });

    it("should wait and run sync func", async () => {
      const a = Date.now();
      const x = await xaa.delay(20, () => "hello");
      expect(x).to.equal("hello");
      expect(Date.now() - a).to.be.above(18);
    });
  });

  describe("defer", function () {
    it("should return defer object that can resolve", () => {
      const defer = new xaa.Defer();
      setTimeout(() => defer.resolve("hello"), 100);
      return defer.promise.then(x => expect(x).equals("hello"));
    });

    it("should return defer object that can reject", () => {
      const defer = xaa.defer();
      setTimeout(() => defer.reject(new Error("oops")), 100);
      return asyncVerify(
        expectError(() => defer.promise),
        r => {
          expect(r).to.be.an("Error");
          expect(r.message).equals("oops");
        }
      );
    });

    it("should allow done used without context", () => {
      const defer = xaa.defer();
      setTimeout(defer.done, 30);
      return defer.promise;
    });

    it("should return defer object with done", () => {
      const defer1 = xaa.defer();
      expect(defer1.done.length).to.below(2);
      setTimeout(() => defer1.done(new Error("oops")));
      const defer2 = xaa.defer();
      setTimeout(() => defer2.done(null, "hello"));
      return asyncVerify(
        expectError(() => defer1.promise),
        err => expect(err.message).to.equal("oops"),
        () => defer2.promise,
        r => expect(r).to.equal("hello")
      );
    });
  });

  describe("timeout", function () {
    it("should timeout run", () => {
      let too;
      return asyncVerify(
        expectError(() => {
          too = xaa.timeout(50, "foo");
          return too.run(xaa.delay(150));
        }),
        err => {
          expect(err.message).equal("foo");
        }
      );
    });

    it("should cancel run", () => {
      let too;
      return asyncVerify(
        expectError(() => {
          too = xaa.timeout(50, "foo");
          const promise = too.run(xaa.delay(150));
          too.cancel();
          return promise;
        }),
        err => {
          expect(err.message).contains("operation cancelled");
          expect(too.isDone()).equal(true);
        }
      );
    });

    it("should ignore cancel if already resolved", () => {
      let too;
      return asyncVerify(
        next => {
          too = xaa.timeout(150, "foo");
          const promise = too.run(Promise.resolve("good"));
          setTimeout(() => {
            too.cancel();
            next(null, promise);
          }, 1);
        },
        promise => promise,
        message => {
          expect(message).equal("good");
        }
      );
    });

    it("should cancel run with custom message", () => {
      let too;
      return asyncVerify(
        expectError(() => {
          too = xaa.timeout(50, "foo");
          const promise = too.run(xaa.delay(150));
          too.cancel("cancelling test");
          return promise;
        }),
        err => {
          expect(err.message).equal("cancelling test");
        }
      );
    });

    it("should timeout run with default msg", () => {
      let too;
      return asyncVerify(
        expectError(() => {
          too = xaa.timeout(50);
          return too.run(xaa.delay(150));
        }),
        err => {
          expect(err.message).contains("operation timed out");
        }
      );
    });

    it("should resolve", () => {
      let too;
      return asyncVerify(
        () => {
          too = xaa.timeout(50, "foo");
          return too.run(Promise.resolve("hello"));
        },
        msg => {
          expect(msg).equal("hello");
        }
      );
    });

    it("should resolve functions", () => {
      return asyncVerify(
        () => {
          return xaa
            .timeout(50, "foo")
            .run([() => Promise.resolve("blah"), Promise.resolve("hello"), "wow"] as any);
        },
        results => {
          expect(results).deep.equal(["blah", "hello", "wow"]);
        }
      );
    });

    it("should resolve bunch of values with runTimeout", () => {
      return asyncVerify(
        async () => {
          return await xaa.runTimeout(
            [
              () => xaa.delay(10, 1),
              () => xaa.delay(15, 2),
              "some value",
              Promise.resolve("more value")
            ] as any,
            50
          );
        },
        results => {
          expect(results).deep.equal([1, 2, "some value", "more value"]);
        }
      );
    });

    it("should fail with runTimeout", () => {
      return asyncVerify(
        expectError(async () => {
          return await xaa.runTimeout(
            [
              () => xaa.delay(10, 1),
              () => xaa.delay(150, 2),
              "some value",
              Promise.resolve("more value")
            ] as any,
            50
          );
        }),
        err => {
          expect(err.message).contains("operation timed out");
        }
      );
    });
  });

  describe("each", function () {
    it("should call for each element in series", async () => {
      let last = 0;
      await xaa.each([1, 2, 3, 4, 5], v => {
        expect(v).to.be.above(last);
        last = v;
        return xaa.delay(Math.random() * 20 + 5);
      });
    });
  });

  describe("map", function () {
    it("should map empty array", () => {
      return xaa.map([]).then(r => {
        expect(r).deep.equal([]);
      });
    });

    it("should execute first level mapping synchronously without concurrency", async () => {
      const output = [];

      const promise = xaa.map(
        [1, 2, 3],
        async v => {
          output.push(v);
        },
        { concurrency: 1 }
      );
      output.push(5);
      await promise;
      expect(output).to.deep.equal([1, 5, 2, 3]);
    });

    it("should execute first level mapping synchronously with concurrency", async () => {
      const output = [];

      const promise = xaa.map(
        [1, 2, 3],
        async v => {
          output.push(v);
        },
        { concurrency: 2 }
      );
      output.push(5);
      await promise;
      expect(output).to.deep.equal([1, 2, 5, 3]);
    });

    it("should execute first level mapping promises with concurrency", async () => {
      const output = [];

      const promise = xaa.map(
        [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
        async v => {
          output.push(v);
        },
        { concurrency: 2 }
      );
      output.push(5);
      await promise;
      expect(output).to.deep.equal([5, 1, 2, 3]);
    });

    it("should map async", async () => {
      const x = await xaa.map([1, 2, 3, 4, 5], async v => {
        await xaa.delay(Math.random() * 20 + 2);
        return v * 3;
      });
      expect(x).to.deep.equal([3, 6, 9, 12, 15]);
    });

    it("should map promises async", async () => {
      const x = await xaa.map(
        [1, 2, 3, 4, 5].map(x => Promise.resolve(x)),
        async v => {
          await xaa.delay(Math.random() * 20 + 2);
          return v * 3;
        }
      );
      expect(x).to.deep.equal([3, 6, 9, 12, 15]);
    });

    it("should map async with concurrency", async () => {
      const a = Date.now();
      const x = await xaa.map(
        [1, 2, 3, 4, 5],
        async v => {
          await xaa.delay(50);
          return v * 3;
        },
        { concurrency: 2 }
      );
      expect(x).to.deep.equal([3, 6, 9, 12, 15]);
      expect(Date.now() - a).to.be.below(200);
    });

    it("should continue with free concurrency slots even if one is stuck", async () => {
      const a = Date.now();
      const doneOrder = [];
      const x = await xaa.map(
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        async v => {
          if (v === 2) {
            await xaa.delay(120);
          } else if (v === 7) {
            await xaa.delay(85);
          }
          await xaa.delay(50);
          doneOrder.push(v);
          return v * 3;
        },
        { concurrency: 3 }
      );
      expect(x).to.deep.equal([3, 6, 9, 12, 15, 18, 21, 24, 27]);
      expect(Date.now() - a).to.be.below(280);
      expect(doneOrder).to.deep.equal([1, 3, 4, 5, 6, 2, 8, 9, 7]);
    });

    it("should return partial for concurrency 1", () => {
      return asyncVerify(
        expectError(() =>
          xaa.map([1, 2, 3, 4], v => {
            if (v === 3) throw new Error("oops");
            return v * 3;
          })
        ),
        err => {
          expect(err).to.be.an("Error");
          expect(err.partial.filter(x => x)).to.deep.equal([3, 6]);
        }
      );
    });

    it("should handle mix result for concurrency", async () => {
      const a = Date.now();
      const doneOrder = [];
      const x = await xaa.map(
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        v => {
          if (v === 2 || v === 7) {
            doneOrder.push(v);
            return v * 3;
          }
          return xaa.delay(50).then(() => {
            doneOrder.push(v);
            return v * 3;
          });
        },
        { concurrency: 3 }
      );
      expect(x).to.deep.equal([3, 6, 9, 12, 15, 18, 21, 24, 27]);
      expect(Date.now() - a).to.be.below(250);
      expect(doneOrder).to.deep.equal([2, 1, 3, 4, 7, 5, 6, 8, 9]);
    });

    it("should handle error from an item", async () => {
      const a = Date.now();
      const doneOrder = [];

      return asyncVerify(
        expectError(() => {
          return xaa.map(
            [1, 2, 3, 4, 5, 6, 7, 8, 9],
            async v => {
              if (v === 2) {
                await xaa.delay(120);
              } else if (v === 7) {
                await xaa.delay(75);
              }
              await xaa.delay(50);
              if (v === 5) {
                throw new Error("Test error");
              }
              doneOrder.push(v);
              return v * 3;
            },
            { concurrency: 3 }
          );
        }),
        err => {
          expect(err).to.be.an("Error");
          expect(err.message).to.equal("Test error");
          expect(Date.now() - a).to.be.below(150);
          expect(doneOrder).to.deep.equal([1, 3, 4]);
        }
      );
    });

    it("should handle immediate error from an item for concurrency", async () => {
      const a = Date.now();
      const doneOrder = [];

      return asyncVerify(
        expectError(() => {
          return xaa.map(
            [1, 2, 3, 4, 5, 6, 7, 8, 9],
            v => {
              if (v === 2 || v === 7) {
                doneOrder.push(v);
                return v * 3;
              }
              if (v === 5) {
                throw new Error("Test error");
              }

              return xaa.delay(50).then(() => {
                doneOrder.push(v);
                return v * 3;
              });
            },
            { concurrency: 3 }
          );
        }),
        async err => {
          expect(Date.now() - a).to.be.below(100);
          await xaa.delay(50);
          expect(err).to.be.an("Error");
          expect(err.message).to.equal("Test error");
          expect(doneOrder).to.deep.equal([2, 1, 3, 4]);
        }
      );
    });

    it("should ignore multiple failures and use the first one", async () => {
      return asyncVerify(
        expectError(() => {
          return xaa.map(
            [1, 2, 3],
            async v => {
              await xaa.delay(v * 10);
              throw new Error(`error-${v}`);
            },
            { concurrency: 3 }
          );
        }),
        err => {
          expect(err.message).to.equal("error-1");
        }
      );
    });

    const testInflight = (observing, expectCount) => {
      let count = 0;
      return asyncVerify(
        expectError(() => {
          return xaa.map(
            [1, 2, 3, 4, 5, 6],
            async (v, ix, context) => {
              if (v === 6) {
                throw new Error("oops");
              }
              await xaa.delay(10);
              if (observing && context.failed) {
                return;
              }

              count++;
            },
            { concurrency: 6 }
          );
        }),
        () => xaa.delay(20),
        () => {
          expect(count).equal(expectCount);
        }
      );
    };

    it("should allow inflight map ops to finish even if error occurred", async () => {
      return testInflight(false, 5);
    });

    it("should allow inflight map ops to observe that error occurred", async () => {
      return testInflight(true, 0);
    });

    it("should allow map to use assertNoFailure to stop", async () => {
      let callCount = 0;
      let finishCount = 0;
      return asyncVerify(
        expectError(() => {
          return xaa.map(
            [1, 2, 3, 4, 5, 6],
            async (v, ix, context) => {
              callCount++;
              if (v === 3) {
                await xaa.delay(1);
                throw new Error("oops");
              }
              await xaa.delay(10);

              context.assertNoFailure();

              finishCount++;
            },
            { concurrency: 2 }
          );
        }),
        () => xaa.delay(20),
        () => {
          expect(callCount).equal(4);
          expect(finishCount).equal(2);
        }
      );
    });

    it("should handle error thrown from non async function", async () => {
      let callCount = 0;
      let finishCount = 0;
      return asyncVerify(
        expectError(() => {
          return xaa.map(
            [1, 2, 3, 4, 5, 6],
            (v, ix, context) => {
              callCount++;
              if (v === 4) {
                throw new Error("oops");
              }
              return xaa.delay(10).then(() => {
                context.assertNoFailure();
                finishCount++;
              });
            },
            { concurrency: 6 }
          );
        }),
        () => xaa.delay(20),
        () => {
          expect(callCount).equal(4);
          expect(finishCount).equal(0);
        }
      );
    });
  });

  describe("filter", function () {
    it("should filter sync", async () => {
      const x = await xaa.filter([1, 2, 3, 4, 5, 6], v => v % 2 === 0);
      expect(x).to.deep.equal([2, 4, 6]);
    });

    it("should filter async", async () => {
      const x = await xaa.filter([1, 2, 3, 4, 5, 6], v => Promise.resolve(v % 2 === 0));
      expect(x).to.deep.equal([2, 4, 6]);
    });
  });

  describe("tryCatch", function () {
    it("should return if there's no error", async () => {
      const x = await xaa.tryCatch(() => Promise.resolve("hello"));
      expect(x).to.equal("hello");
      const x2 = await xaa.tryCatch(() => "hello");
      expect(x2).to.equal("hello");
    });

    it("should catch error", async () => {
      const x = await xaa.tryCatch(() => {
        throw new Error("test");
      });
      expect(x).to.equal(undefined);
      const x2 = await xaa.tryCatch(() => {
        throw new Error("test");
      }, "oops");
      expect(x2).to.equal("oops");
    });

    it("should catch error and call sync handler", async () => {
      const x = await xaa.tryCatch(
        () => {
          throw new Error("blah");
        },
        () => "oops"
      );
      expect(x).to.equal("oops");
    });

    it("should catch error and call async handler", async () => {
      const x = await xaa.tryCatch(
        () => {
          throw new Error("blah");
        },
        () => Promise.resolve("oops")
      );
      expect(x).to.equal("oops");
    });

    it("should handle a promise", async () => {
      const x = await xaa.tryCatch(xaa.delay(50, "hello"));
      expect(x).to.equal("hello");
    });
  });

  describe("wrap", function () {
    it("should wrap direct throws into async", () => {
      let error;
      return xaa
        .wrap(() => {
          throw new Error("blah");
        })
        .then(() => {
          throw new Error("expecting error");
        })
        .catch(err => {
          error = err;
        })
        .then(() => {
          expect(error).to.be.an("Error");
          expect(error.message).equal("blah");
        });
    });

    it("should wrap async error", () => {
      let error;
      return xaa
        .wrap(() => {
          return Promise.reject(new Error("blah"));
        })
        .then(() => {
          throw new Error("expecting error");
        })
        .catch(err => {
          error = err;
        })
        .then(() => {
          expect(error).to.be.an("Error");
          expect(error.message).equal("blah");
        });
    });

    it("should call with args", () => {
      return xaa
        .wrap(
          (...numbers) => {
            return numbers.reduce((s, x) => s + x, 0);
          },
          1,
          2,
          3,
          4
        )
        .then(a => {
          expect(a).equal(10);
        });
    });

    it("should call with no args", () => {
      return xaa.wrap((...args) => {
        expect(args.length).equal(0);
      });
    });

    it("should call with args that are undefined", () => {
      return xaa.wrap(
        (...args) => {
          expect(args.length).equal(2);
        },
        undefined,
        undefined
      );
    });
  });
});
