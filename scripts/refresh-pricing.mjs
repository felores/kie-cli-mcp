#!/usr/bin/env node
// This command records reviewed formula proposals; it never changes executable rate formulas.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, relative, resolve } from "node:path";

const scriptPath = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(scriptPath), "..");
const DEFAULT_MANIFEST_PATH = resolve(
  REPOSITORY_ROOT,
  "packages/core/src/pricing/evidence-manifest.json",
);

function usage() {
  return "Usage: npm run pricing:refresh -- [--apply --proposals <path>]";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function requireText(value, field, index) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Formula proposal ${index + 1} requires ${field}.`);
  }
  return value;
}

function requireHttpsUrl(value, field, index) {
  const text = requireText(value, field, index);
  try {
    if (new URL(text).protocol !== "https:") throw new Error("not HTTPS");
  } catch {
    throw new Error(`Formula proposal ${index + 1} requires an HTTPS ${field}.`);
  }
  return text;
}

function validateTestReference(testPath, repositoryRoot, index) {
  const text = requireText(testPath, "tests", index);
  if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(text)) {
    throw new Error(`Formula proposal ${index + 1} test reference must target a test file.`);
  }
  const resolved = resolve(repositoryRoot, text);
  if (relative(repositoryRoot, resolved).startsWith("..") || !existsSync(resolved)) {
    throw new Error(`Formula proposal ${index + 1} references a missing repository test: ${text}.`);
  }
  return text;
}

function validateExactCreditsFormula(value, index) {
  const formula = requireText(value, "formula", index);
  // Keep proposed rates declarative. This intentionally accepts no expressions or conversions.
  if (!/^\d+(?:\.\d+)?\s+credits?\s+per\s+(?:\d+\s+)?(?:images?|seconds?|minutes?|requests?|videos?|audio|characters?|tokens?)$/i.test(formula)) {
    throw new Error(
      `Formula proposal ${index + 1} must use an exact credits-only formula such as "9 credits per image".`,
    );
  }
  return formula;
}

export function parseRefreshArguments(argv) {
  let apply = false;
  let proposalsPath;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--proposals") {
      proposalsPath = argv[index + 1];
      if (!proposalsPath || proposalsPath.startsWith("--")) {
        throw new Error("--proposals requires a JSON file path.");
      }
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      return { help: true, apply: false };
    }
    throw new Error(`Unknown pricing refresh argument: ${argument}. ${usage()}`);
  }
  if (proposalsPath && !apply) {
    throw new Error("--proposals requires --apply because refresh is read-only by default.");
  }
  return { help: false, apply, proposalsPath };
}

export function validateFormulaProposals(proposals, repositoryRoot = REPOSITORY_ROOT) {
  if (!Array.isArray(proposals)) throw new Error("proposedFormulaUpdates must be an array.");
  return proposals.map((proposal, index) => {
    if (!proposal || typeof proposal !== "object") {
      throw new Error(`Formula proposal ${index + 1} must be an object.`);
    }
    if (proposal.kind !== "exact-credits") {
      throw new Error(`Formula proposal ${index + 1} must declare kind exact-credits.`);
    }
    const formula = validateExactCreditsFormula(proposal.formula, index);
    if (!isIsoDate(proposal.verifiedAt)) {
      throw new Error(`Formula proposal ${index + 1} requires an ISO verification date.`);
    }
    if (!Array.isArray(proposal.tests) || proposal.tests.length === 0) {
      throw new Error(`Formula proposal ${index + 1} requires one or more tests.`);
    }
    return {
      kind: proposal.kind,
      scope: requireText(proposal.scope, "scope", index),
      formula,
      sourceUrl: requireHttpsUrl(proposal.sourceUrl, "sourceUrl", index),
      sourceFingerprint: requireText(proposal.sourceFingerprint, "sourceFingerprint", index),
      verifiedAt: proposal.verifiedAt,
      tests: proposal.tests.map((testPath) => validateTestReference(testPath, repositoryRoot, index)),
    };
  });
}

function sourceFreshness(sources, now) {
  const staleAfter = new Date(now);
  staleAfter.setDate(staleAfter.getDate() - 90);
  return sources.map((source) => ({
    ...source,
    freshness: isIsoDate(source.verifiedAt) && new Date(source.verifiedAt) >= staleAfter
      ? "fresh"
      : "stale",
  }));
}

export function refreshPricing({
  apply = false,
  proposalsPath,
  manifestPath = DEFAULT_MANIFEST_PATH,
  repositoryRoot = REPOSITORY_ROOT,
  now = new Date(),
} = {}) {
  const manifest = readJson(manifestPath);
  const report = {
    mode: apply ? "apply" : "read-only",
    mutated: false,
    generatedAt: now.toISOString(),
    evidence: sourceFreshness(manifest.reviewedSources ?? [], now),
    existingFormulaCount: Array.isArray(manifest.existingFormulaEvidence)
      ? manifest.existingFormulaEvidence.length
      : 0,
  };
  if (!apply) {
    return {
      ...report,
      noOp: true,
      message: "Read-only refresh report. No files were changed.",
    };
  }
  if (!proposalsPath) {
    return {
      ...report,
      noOp: true,
      message: "No eligible proposed formula updates were supplied. No files were changed.",
    };
  }

  const candidate = readJson(resolve(proposalsPath));
  const proposals = validateFormulaProposals(candidate.proposedFormulaUpdates, repositoryRoot);
  if (proposals.length === 0) {
    return {
      ...report,
      noOp: true,
      message: "No eligible proposed formula updates were supplied. No files were changed.",
    };
  }
  if (!isIsoDate(candidate.reviewedAt)) {
    throw new Error("Proposal file requires reviewedAt as an ISO date.");
  }

  // This is the sole write path. Formula code changes remain an explicit reviewed edit.
  const nextManifest = {
    ...manifest,
    lastReviewedAt: candidate.reviewedAt,
    proposedFormulaUpdates: proposals,
  };
  writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
  return {
    ...report,
    mutated: true,
    noOp: false,
    proposedFormulaUpdateCount: proposals.length,
    message: "Validated formula proposals were recorded in the evidence manifest. Rate-card code was not changed.",
  };
}

function main() {
  try {
    const options = parseRefreshArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    console.log(JSON.stringify(refreshPricing(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
