# Local data boundary

`cyberquest.seed.json` is the versioned, reproducible data used by the local
learning demonstration. It may contain only demo identities, challenge
metadata, server-side flag hashes, and course definitions.

`cyberquest.local.json` is a runtime copy. It contains locally created users,
attempts, scores, unlocked hints, sessions, and audit activity. It is ignored
by Git; deleting it makes the server recreate a clean copy at its next start.

The local compatibility store currently uses SHA-256 hashes because it must
read the existing demo data. The PostgreSQL seed in `../prisma/seed.ts` uses
Argon2id verification hashes only. Neither file may contain plaintext flags,
plaintext passwords, tokens, or real user data.
