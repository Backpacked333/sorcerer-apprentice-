import { seedDemo } from "../lib/seed";

seedDemo({ ifMissing: process.argv.includes("--if-missing") }).catch(() => {
  console.error("Sample initialization failed; existing data was not reset on boot.");
  process.exitCode = 1;
});
