#!/bin/bash
# Wrapper to run ESLint and show output but never fail (warnings only at commit
# time; the pre-push hook and CI enforce it).
#
# typescript-eslint does not support TypeScript 7, so ESLint must run against
# the TypeScript 6 alias. The `lint` script sets NODE_OPTIONS to preload the
# shim; invoking eslint directly here would crash with a TS7 error. Preload the
# same shim so this wrapper actually lints instead of silently failing.
NODE_OPTIONS="--require ./scripts/use-ts6.cjs" bun run eslint "$@" >&2

# Always exit 0 (warnings only, don't block commit)
exit 0
