#!/usr/bin/env node
// Read-only audit. It never fetches pricing data and never writes the rate card.
import { buildPricingAudit } from "../packages/core/dist/index.js";

console.log(JSON.stringify(buildPricingAudit(), null, 2));
