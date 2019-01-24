"use strict";

const xaa = require("../..");

describe("xaa", function() {
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
  });
});
