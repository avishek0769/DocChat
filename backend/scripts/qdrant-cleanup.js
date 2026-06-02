#!/usr/bin/env node
import "dotenv/config";
import { cleanupQdrantCollections } from "../utils/qdrantCleanup.js";

function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        force: false,
        minAgeDays: undefined,
    };

    for (const arg of args) {
        if (arg === "--force" || arg === "-f") {
            result.force = true;
        }

        if (arg.startsWith("--min-age-days=")) {
            const value = Number(arg.split("=")[1]);
            if (Number.isFinite(value) && value >= 0) {
                result.minAgeDays = Math.floor(value);
            }
        }

        if (arg === "--dry-run" || arg === "-d") {
            result.force = false;
        }
    }

    return result;
}

async function main() {
    const { force, minAgeDays } = parseArgs();
    const result = await cleanupQdrantCollections({ force, minAgeDays });
    console.log(JSON.stringify(result, null, 2));
    if (!force) {
        console.log("Note: this was a dry-run. Pass --force or -f to delete orphaned collections.");
    }
}

main().catch((error) => {
    console.error("Qdrant cleanup failed:", error?.message || error);
    process.exit(1);
});
