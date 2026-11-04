# Releases

Prepare v1.0.0-rc.1 now; the orchestrator tags after the version PR merges on green CI. The RC is a GitHub pre-release and never takes Latest from a stable release (currently v0.8.0); it remains visible in the releases list and through its exact tag URL.

Final v1.0.0 follows final acceptance on 9 Nov 2026. The final-acceptance PR bumps the versions back to 1.0.0, including Python. npm artifacts use 1.0.0-rc.1 now; Python wheel and sdist filenames use PEP 440 1.0.0rc1. Desktop inherits the root version and accepts the explicit rc suffix.
