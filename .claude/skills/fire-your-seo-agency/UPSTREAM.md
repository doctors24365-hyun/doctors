# Upstream

- Source: https://github.com/leopard627/fire-your-seo-agency
- Vendored commit: `eb9be9f` (v1.1.0, 2026-08-27)
- License: MIT (see `LICENSE`)

Installed here as a **project skill** (`.claude/skills/`), so it is available to
Claude Code sessions in this repository without a plugin marketplace install.

Not vendored from upstream:
- `assets/` — 1.2 MB social preview image, marketing only
- `.claude-plugin/` — plugin/marketplace manifests, only needed for the
  `/plugin install` path

## Updating

```bash
git clone --depth 1 https://github.com/leopard627/fire-your-seo-agency /tmp/fysa
rsync -a --delete --exclude .git --exclude assets --exclude .claude-plugin --exclude UPSTREAM.md \
  /tmp/fysa/ .claude/skills/fire-your-seo-agency/
```
Then bump the vendored commit above.
