import { describe, it } from "vitest";
import * as xaa from "../../src";

describe("index", function () {
  it("should load", () => {
    return xaa.delay(20);
  });
});
