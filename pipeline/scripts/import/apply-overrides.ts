import { parseFlag } from "../lib/curation";
import { applyOverrides } from "./lib/overrides";

// Slugs in sources.json can disappear upstream; that must not fail the daily
// workflow. Set OVERRIDES_STRICT=1 to turn missing slugs back into an error.
const strict = parseFlag("OVERRIDES_STRICT", process.env.OVERRIDES_STRICT);

applyOverrides({ strict }).catch((error) => {
  console.error("✖ Final override application failed:");
  console.error(error);
  process.exit(1);
});
