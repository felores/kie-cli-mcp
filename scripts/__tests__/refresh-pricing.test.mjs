import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { parseRefreshArguments, refreshPricing } from "../refresh-pricing.mjs";

const repositoryRoot = process.cwd();
const sourceManifest = join(
  repositoryRoot,
  "packages/core/src/pricing/evidence-manifest.json",
);
const temporaryDirectories = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "kie-pricing-refresh-"));
  temporaryDirectories.push(directory);
  const manifestPath = join(directory, "evidence-manifest.json");
  const proposalsPath = join(directory, "proposals.json");
  writeFileSync(manifestPath, readFileSync(sourceManifest));
  return { manifestPath, proposalsPath };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe("pricing refresh", () => {
  test("defaults to a read-only freshness report", () => {
    const { manifestPath } = fixture();
    const before = readFileSync(manifestPath, "utf8");
    assert.deepEqual(parseRefreshArguments([]), {
      help: false,
      apply: false,
      proposalsPath: undefined,
    });
    const report = refreshPricing({
      manifestPath,
      repositoryRoot,
      now: new Date("2026-08-17T00:00:00.000Z"),
    });
    assert.equal(report.mode, "read-only");
    assert.equal(report.mutated, false);
    assert.equal(report.noOp, true);
    assert.ok(report.evidence.every((source) => source.freshness === "fresh"));
    assert.equal(readFileSync(manifestPath, "utf8"), before);
  });

  test("rejects proposal input without the explicit apply boundary", () => {
    assert.throws(
      () => parseRefreshArguments(["--proposals", "candidate.json"]),
      /requires --apply/,
    );
    assert.throws(
      () => parseRefreshArguments(["--unexpected"]),
      /Unknown pricing refresh argument/,
    );
  });

  test("makes apply without eligible proposals an explicit no-op", () => {
    const { manifestPath } = fixture();
    const before = readFileSync(manifestPath, "utf8");
    const report = refreshPricing({
      apply: true,
      manifestPath,
      repositoryRoot,
    });
    assert.equal(report.mutated, false);
    assert.equal(report.noOp, true);
    assert.match(report.message, /No eligible proposed formula updates/);
    assert.equal(readFileSync(manifestPath, "utf8"), before);
  });

  test("validates exact-credit proposal evidence before mutating only the manifest", () => {
    const { manifestPath, proposalsPath } = fixture();
    writeFileSync(
      proposalsPath,
      JSON.stringify({
        reviewedAt: "2026-08-17",
        proposedFormulaUpdates: [
          {
            kind: "exact-credits",
            scope: "example_tool:text-to-image:model=example",
            formula: "9 credits per image",
            sourceUrl: "https://example.com/pricing",
            sourceFingerprint: "example-pricing-2026-08-17:9-per-image",
            verifiedAt: "2026-08-17",
            tests: ["scripts/__tests__/refresh-pricing.test.mjs"],
          },
        ],
      }),
    );
    const report = refreshPricing({
      apply: true,
      proposalsPath,
      manifestPath,
      repositoryRoot,
    });
    assert.equal(report.mutated, true);
    assert.equal(report.proposedFormulaUpdateCount, 1);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(
      manifest.proposedFormulaUpdates[0].formula,
      "9 credits per image",
    );
  });

  test("does not mutate when exact-credit evidence is incomplete", () => {
    const { manifestPath, proposalsPath } = fixture();
    const before = readFileSync(manifestPath, "utf8");
    const validProposal = {
      kind: "exact-credits",
      scope: "example_tool:text-to-image",
      formula: "9 credits per image",
      sourceUrl: "https://example.com/pricing",
      sourceFingerprint: "example",
      verifiedAt: "2026-08-17",
      tests: ["scripts/__tests__/refresh-pricing.test.mjs"],
    };
    const incompleteEvidence = [
      ["scope", ""],
      ["sourceUrl", "http://example.com/pricing"],
      ["sourceFingerprint", ""],
      ["verifiedAt", "not-a-date"],
      ["tests", []],
      ["formula", "9 per image"],
    ];
    for (const [field, value] of incompleteEvidence) {
      writeFileSync(
        proposalsPath,
        JSON.stringify({
          reviewedAt: "2026-08-17",
          proposedFormulaUpdates: [{ ...validProposal, [field]: value }],
        }),
      );
      assert.throws(() =>
        refreshPricing({
          apply: true,
          proposalsPath,
          manifestPath,
          repositoryRoot,
        }),
      );
      assert.equal(readFileSync(manifestPath, "utf8"), before);
    }
  });

  test("rejects non-deterministic, non-credit, and ambiguous formula language", () => {
    const { manifestPath, proposalsPath } = fixture();
    const before = readFileSync(manifestPath, "utf8");
    const proposal = {
      kind: "exact-credits",
      scope: "example_tool:text-to-image",
      sourceUrl: "https://example.com/pricing",
      sourceFingerprint: "example",
      verifiedAt: "2026-08-17",
      tests: ["scripts/__tests__/refresh-pricing.test.mjs"],
    };
    const invalidFormulas = [
      "approximately 9 credits per image",
      "8-10 credits per image",
      "USD 0.05 per image",
      "$0.05 per image",
      "9 credits depending on model",
      "9 credits at the current rate",
      "9 credits per rate",
      "9 credits per image or 16 per second",
    ];

    for (const formula of invalidFormulas) {
      writeFileSync(
        proposalsPath,
        JSON.stringify({
          reviewedAt: "2026-08-17",
          proposedFormulaUpdates: [{ ...proposal, formula }],
        }),
      );
      assert.throws(
        () =>
          refreshPricing({
            apply: true,
            proposalsPath,
            manifestPath,
            repositoryRoot,
          }),
        /exact credits-only formula/,
      );
      assert.equal(readFileSync(manifestPath, "utf8"), before);
    }
  });

  test("rejects non-calendar ISO verification dates", () => {
    const { manifestPath, proposalsPath } = fixture();
    const before = readFileSync(manifestPath, "utf8");
    writeFileSync(
      proposalsPath,
      JSON.stringify({
        reviewedAt: "2026-08-17",
        proposedFormulaUpdates: [
          {
            kind: "exact-credits",
            scope: "example_tool:text-to-image",
            formula: "9 credits per image",
            sourceUrl: "https://example.com/pricing",
            sourceFingerprint: "example",
            verifiedAt: "2026-02-31",
            tests: ["scripts/__tests__/refresh-pricing.test.mjs"],
          },
        ],
      }),
    );

    assert.throws(
      () =>
        refreshPricing({
          apply: true,
          proposalsPath,
          manifestPath,
          repositoryRoot,
        }),
      /ISO verification date/,
    );
    assert.equal(readFileSync(manifestPath, "utf8"), before);
  });
});
