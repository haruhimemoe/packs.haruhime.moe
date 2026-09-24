/**
 * @file tests/unit/tooling/vitest-projects.test.ts
 * @desc Every Vitest project must match at least one test file. A multi-project run only fails
 *       when ALL projects are empty, so a broken include glob in one project would otherwise
 *       silently drop its tests from CI.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../../vitest.config";

type Project = { test: { name: string; include: string[] } };
const projects = (config.test?.projects ?? []) as Project[];

describe("vitest projects", () => {
  it("defines unit, components, and integration", () => {
    expect(projects.map((p) => p.test.name)).toEqual(["unit", "components", "integration"]);
  });

  it.each(projects.map((p) => [p.test.name, p]))(
    "%s include globs match at least one test file",
    (_name, project) => {
      const files = (project as Project).test.include.flatMap((g) => globSync(g));
      expect(files.length).toBeGreaterThan(0);
    },
  );
});
