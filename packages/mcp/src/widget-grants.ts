import { createHash, randomBytes } from "node:crypto";

// MCP Apps widget grants are minted by one Server instance but must be
// consumable from any other instance serving the same owner, so the store is
// process-level and keyed by owner instead of living in the per-Server
// closure. Bounds mirror the previous in-instance behaviour: a bounded number
// of active grants per owner, a short TTL, and a use limit per grant.
const GRANT_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_GRANTS_PER_OWNER = 16;
const MAX_USES_PER_GRANT = 4;
const TOKEN_BYTES = 32;

interface GrantRecord {
  expiresAt: number;
  uses: number;
}

export class WidgetGrantService {
  private readonly byOwner = new Map<string, Map<string, GrantRecord>>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  createGrant(owner: string): string {
    const grants = this.grantsFor(owner);
    const currentTime = this.now();
    for (const [key, record] of grants) {
      if (record.expiresAt <= currentTime) grants.delete(key);
    }
    while (grants.size >= MAX_ACTIVE_GRANTS_PER_OWNER) {
      const oldest = grants.keys().next().value as string | undefined;
      if (!oldest) break;
      grants.delete(oldest);
    }
    const grant = randomBytes(TOKEN_BYTES).toString("base64url");
    grants.set(this.hash(grant), {
      expiresAt: currentTime + GRANT_TTL_MS,
      uses: 0,
    });
    return grant;
  }

  validateGrant(owner: string, grant: string): boolean {
    const grants = this.grantsFor(owner);
    const key = this.hash(grant);
    const record = grants.get(key);
    if (
      !record ||
      record.expiresAt <= this.now() ||
      record.uses >= MAX_USES_PER_GRANT
    ) {
      grants.delete(key);
      if (grants.size === 0) this.byOwner.delete(owner);
      return false;
    }
    record.uses += 1;
    return true;
  }

  private grantsFor(owner: string): Map<string, GrantRecord> {
    let grants = this.byOwner.get(owner);
    if (!grants) {
      grants = new Map();
      this.byOwner.set(owner, grants);
    }
    return grants;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
