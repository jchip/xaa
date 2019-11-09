"use strict";

const xaa = require("../..");

describe("xaa", function() {
  describe("delay", function() {
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
      expect(Date.now() - a).to.be.above(19);
    });
  });

  describe("each", function() {
    it("should call for each element in series", async () => {
      let last = 0;
      await xaa.each([1, 2, 3, 4, 5], v => {
        expect(v).to.be.above(last);
        last = v;
        return xaa.delay(Math.random() * 20 + 5);
      });
    });
  });

  describe("map", function() {
    it("should map async", async () => {
      const x = await xaa.map([1, 2, 3, 4, 5], async v => {
        await xaa.delay(Math.random() * 20 + 2);
        return v * 3;
      });
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
            await xaa.delay(75);
          }
          await xaa.delay(50);
          doneOrder.push(v);
          return v * 3;
        },
        { concurrency: 3 }
      );
      expect(x).to.deep.equal([3, 6, 9, 12, 15, 18, 21, 24, 27]);
      expect(Date.now() - a).to.be.below(250);
      expect(doneOrder).to.deep.equal([1, 3, 4, 5, 6, 2, 8, 9, 7]);
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
      let expectedError;
      let res;
      try {
        res = await xaa.map(
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
      } catch (err) {
        expectedError = err;
      }
      expect(expectedError).to.be.ok;
      expect(expectedError.message).to.equal("Test error");
      expect(res).to.equal(undefined);
      expect(Date.now() - a).to.be.below(150);
      expect(doneOrder).to.deep.equal([1, 3, 4]);
    });

    it("should handle immediate error from an item for concurrency", async () => {
      const a = Date.now();
      const doneOrder = [];
      let expectedError;
      let res;

      try {
        res = await xaa.map(
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
      } catch (err) {
        expectedError = err;
      }

      expect(expectedError).to.be.ok;
      expect(expectedError.message).to.equal("Test error");
      expect(res).to.equal(undefined);
      expect(Date.now() - a).to.be.below(100);
      expect(doneOrder).to.deep.equal([2, 1, 3, 4, 7]);
    });
  });

  describe("filter", function() {
    it("should filter sync", async () => {
      const x = await xaa.filter([1, 2, 3, 4, 5, 6], v => v % 2 === 0);
      expect(x).to.deep.equal([2, 4, 6]);
    });

    it("should filter async", async () => {
      const x = await xaa.filter([1, 2, 3, 4, 5, 6], v => Promise.resolve(v % 2 === 0));
      expect(x).to.deep.equal([2, 4, 6]);
    });
  });

  describe("try", function() {
    it("should return if there's no error", async () => {
      const x = await xaa.try(() => Promise.resolve("hello"));
      expect(x).to.equal("hello");
      const x2 = await xaa.try(() => "hello");
      expect(x2).to.equal("hello");
    });

    it("should catch error", async () => {
      const x = await xaa.try(() => {
        throw new Error("test");
      });
      expect(x).to.equal(undefined);
      const x2 = await xaa.try(() => {
        throw new Error("test");
      }, "oops");
      expect(x2).to.equal("oops");
    });

    it("should catch error and call sync handler", async () => {
      const x = await xaa.try(
        () => {
          throw new Error("blah");
        },
        () => "oops"
      );
      expect(x).to.equal("oops");
    });

    it("should catch error and call async handler", async () => {
      const x = await xaa.try(
        () => {
          throw new Error("blah");
        },
        () => Promise.resolve("oops")
      );
      expect(x).to.equal("oops");
    });
  });

  describe("wrap", function() {
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
