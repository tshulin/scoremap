# Grademax VPS install — the blind relay

The VPS runs exactly one thing: the **blind relay** (`relay/`) behind Caddy for
TLS. It bridges the browser's WebSocket to `<district>.edupoint.com:443` and
pipes ciphertext both ways. Sign-in, scraping, parsing, and grade math all
happen **in the browser** — neither the relay nor Caddy can ever see a
password, cookie, or grade (Caddy terminates only the *outer* wss TLS; the
payload it forwards is the browser↔Edupoint TLS ciphertext).

Because of that, **no grades/attendance code lives on the VPS at all** — the
gradebook parser slot and the sample-data fallbacks live in the site
(`src/portal/pages/gradebook/index.ts`, `src/data/placeholders.js`). When the
term starts and the parser is written, the VPS needs **zero changes**.

---

## 0. What you need first

1. **The VPS's public IP**, SSH access as root (Ubuntu, ports 22/80/443 open —
   check the provider's cloud firewall too, not just the machine).
2. **A DNS name for the relay** pointing at that IP. The site is HTTPS, so the
   relay must be reachable over `wss://`, which needs a real certificate, which
   needs a name. Pick one:
   - **Own domain** — add an A record, e.g. `relay.yourdomain.com → <VPS IP>`.
   - **DuckDNS (free, recommended if you have no domain)** — create a
     subdomain at duckdns.org and point it at the IP → `something.duckdns.org`.
   - **sslip.io (zero signup, fallback)** — `<ip-with-dashes>.sslip.io`
     resolves to the IP automatically (e.g. `203-0-113-7.sslip.io` →
     `203.0.113.7`). Caveat: certificate issuance for sslip.io names can hit
     Let's Encrypt's shared rate limits; if Caddy can't get a cert, switch to
     DuckDNS.

Caddy obtains and renews the certificate automatically once DNS resolves to
the VPS.

## 1. Copy the code up (from this Windows machine)

Only `relay/` and `deploy/` go to the VPS — the rest of `local/` is the
retired server-side backend, kept for reference.

```powershell
ssh root@<VPS-IP> "mkdir -p /root/grademax"
scp -r C:\Users\Tiger\Documents\Projects\grademax\local\relay  root@<VPS-IP>:/root/grademax/relay
scp -r C:\Users\Tiger\Documents\Projects\grademax\local\deploy root@<VPS-IP>:/root/grademax/deploy
```

## 2. Install on the VPS

```bash
ssh root@<VPS-IP>
RELAY_DOMAIN=<your-relay-dns-name> bash /root/grademax/deploy/install.sh
```

The installer is idempotent (safe to re-run). It:

- installs Node 22 (official tarball) if the machine has nothing ≥ 22;
- installs Caddy from its apt repo and writes `/etc/caddy/Caddyfile`
  (`<domain> → reverse_proxy 127.0.0.1:8080`);
- runs `npm ci` in `relay/`;
- writes `/etc/grademax-relay.env` — `PORT=8080`,
  `ALLOWED_ORIGINS=https://www.scoremap.org,https://scoremap.org,https://tshulin.github.io`,
  `TRUST_FORWARDED_FOR=true`
  (correct because Caddy fronts the relay and forwards the real client IP);
- installs a systemd unit `grademax-relay` (auto-restart, starts on boot);
- opens 22/80/443 in ufw and enables it (skip with `SKIP_UFW=true`).

Knobs: `GRADEMAX_DIR` (default `/root/grademax`), `ALLOWED_ORIGINS`,
`NODE_VERSION`, `SKIP_UFW` — see the header of `deploy/install.sh`.

## 3. Verify

```bash
# Unit tests (guards + piping), on the VPS:
cd /root/grademax/relay && npm test

# The deployed endpoint, end to end (DNS -> Caddy TLS -> relay -> portal).
# Checks a real TLS handshake through the tunnel, the Origin pin, and the
# host allowlist:
node /root/grademax/deploy/check-wss.mjs wss://<your-relay-dns-name>

# Optional deeper proof of blindness (boots a scratch relay, dumps relayed
# bytes, greps them for the request plaintext):
cd /root/grademax/relay && SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com node verify-live.mjs
```

Watch the relay's metadata-only log: `journalctl -u grademax-relay -f`.

## 4. Point the site at the relay

The site bakes the relay URL in at build time (`VITE_RELAY_URL` in
`.github/workflows/deploy.yml`), so set the repo variable and redeploy Pages.

Via the GitHub UI: repo **Settings → Secrets and variables → Actions →
Variables → New repository variable**: name `VITE_RELAY_URL`, value
`wss://<your-relay-dns-name>` — then **Actions → deploy-web → Run workflow**.

Or from this machine over the REST API (no `gh` CLI installed; Git Bash):

```bash
tok=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p')

# Create the variable (use the PATCH form below instead if it already exists):
curl -sS -X POST https://api.github.com/repos/tshulin/grademax/actions/variables \
  -H "Authorization: Bearer $tok" -H "Accept: application/vnd.github+json" \
  -d '{"name":"VITE_RELAY_URL","value":"wss://<your-relay-dns-name>"}'
curl -sS -X PATCH https://api.github.com/repos/tshulin/grademax/actions/variables/VITE_RELAY_URL \
  -H "Authorization: Bearer $tok" -H "Accept: application/vnd.github+json" \
  -d '{"name":"VITE_RELAY_URL","value":"wss://<your-relay-dns-name>"}'

# Trigger the Pages deploy:
curl -sS -X POST https://api.github.com/repos/tshulin/grademax/actions/workflows/deploy.yml/dispatches \
  -H "Authorization: Bearer $tok" -H "Accept: application/vnd.github+json" \
  -d '{"ref":"main"}'
```

Then open **https://www.scoremap.org/** (since 2026-08-05; needs the repo
Actions variable `VITE_BASE=/`) and sign in with a real StudentVUE account. Expected today (out of term): student info, documents, and
attendance load live; grades show *"No active grading period — grades will
appear when the term starts."*

## 5. Status of grades & attendance (why some data is placeholder)

- **Gradebook** — the parser can only be written against a captured
  active-term page; until then `parseGradebook` throws and the site shows a
  friendly message (or the flagged sample gradebook when a build sets
  `VITE_PLACEHOLDER_DATA=true` — never set it on the production deploy). The
  step-by-step for filling the parser slot is in the site repo:
  `src/portal/pages/gradebook/index.ts` and `ADDING_REAL_DATA.md`.
- **Attendance** — the real parser is live; the absence-row shape is a
  reconstruction until the account shows a real absence. The UI surfaces
  `unreadableAbsences` if rows fail to parse.
- Neither lands on the VPS. The relay is done.

## 6. Later: moving to a bought domain

Every place a domain lives is a single config value, so the move is three
small steps. Say the new domain is `newdomain.com`, the site will live at
`https://newdomain.com`, and the relay at `relay.newdomain.com`.

**a. Move the relay** — add a DNS A record `relay.newdomain.com → <VPS IP>`,
then re-run the (idempotent) installer with the new values; it regenerates the
Caddyfile and env and restarts everything:

```bash
RELAY_DOMAIN=relay.newdomain.com ALLOWED_ORIGINS=https://newdomain.com \
  bash /root/grademax/deploy/install.sh
```

During a transition you can keep both site origins working:
`ALLOWED_ORIGINS=https://tshulin.github.io,https://newdomain.com` (the relay
takes a comma-separated list).

**b. Move the site** — configure the custom domain in repo Settings → Pages,
then update the two Actions variables and redeploy: `VITE_RELAY_URL` →
`wss://relay.newdomain.com`, and `VITE_BASE` → `/` (a custom-domain Pages
site serves from the root, not `/grademax/`; the deploy workflow defaults to
`/grademax/` only while on github.io).

**c. Verify** — then sign in on the new site URL after:

```bash
node /root/grademax/deploy/check-wss.mjs wss://relay.newdomain.com \
  ca-pleas-psv.edupoint.com https://newdomain.com
```

## 7. Ops quick reference

| What | How |
|---|---|
| Relay status / logs | `systemctl status grademax-relay` / `journalctl -u grademax-relay -f` |
| Caddy status / logs (cert issues) | `systemctl status caddy` / `journalctl -u caddy -f` |
| Change origins / limits | edit `/etc/grademax-relay.env`, then `systemctl restart grademax-relay` |
| Change the relay domain | edit `/etc/caddy/Caddyfile`, then `systemctl reload caddy` (and update `VITE_RELAY_URL` + redeploy the site) |
| Update relay code | re-`scp` `relay/`, then `systemctl restart grademax-relay` |

**If sign-in fails on the site:** run the `check-wss.mjs` line from §3 first —
it splits the problem. Tunnel check fails → DNS/Caddy/relay (check
`journalctl -u caddy` for certificate errors). Tunnel ok but sign-in still
fails → open the browser console on the site; a relay-connection error means
the built site's `VITE_RELAY_URL` doesn't match the deployed domain (re-check
§4); an `AUTH_FAILED` means the portal rejected the credentials themselves.

## 8. Partner access — monitor-only SFTP jail

A second person can watch the relay without seeing anything else on the VPS.
The design: a `partner` user who can only SFTP (no shell, no commands, no
tunneling), chrooted into `/srv/partner`, which contains exactly two things:

- `grademax/` — a **read-only bind mount** of `/root/grademax` (relay code +
  deploy scripts; the env file at `/etc/grademax-relay.env` stays outside);
- `logs/relay.log` — the relay's journald log mirrored to a file by a small
  service (`relay-log-mirror`), because putting the user in the
  `systemd-journal` group would expose *every* unit's logs, not just the
  relay's.

From inside the jail `/srv/partner` *is* the filesystem: no `/etc`, no
process list, no other users or projects. Auth is key-only; the account has
no password and `nologin` as its shell.

### Setup (idempotent; run as root on the VPS)

```bash
set -euo pipefail

# 1. The user. useradd leaves the password locked; nologin is belt-and-braces
#    (with ForceCommand internal-sftp the shell is never invoked anyway).
id -u partner >/dev/null 2>&1 || useradd -m -s /usr/sbin/nologin partner

# 2. The jail. sshd's ChrootDirectory rules: every path component must be
#    root-owned and not group/other-writable.
mkdir -p /srv/partner/grademax /srv/partner/logs
chown root:root /srv/partner /srv/partner/grademax /srv/partner/logs
chmod 755 /srv/partner /srv/partner/grademax /srv/partner/logs

# 3. Read-only view of the backend. ro at the *mount* level — file
#    permissions could not make a bind mount read-only on their own.
grep -q '/srv/partner/grademax' /etc/fstab ||
  echo '/root/grademax /srv/partner/grademax none bind,ro 0 0' >> /etc/fstab
mountpoint -q /srv/partner/grademax || {
  mount --bind /root/grademax /srv/partner/grademax
  mount -o remount,ro,bind /srv/partner/grademax
}
chmod -R a+rX /root/grademax   # partner must be able to read through the mount

# 4. Journal → file mirror. --cursor-file survives restarts without
#    duplicating lines; >> (append) keeps logrotate's copytruncate safe.
cat > /etc/systemd/system/relay-log-mirror.service <<'UNIT'
[Unit]
Description=Mirror grademax-relay journal to partner-readable file
After=grademax-relay.service

[Service]
ExecStart=/bin/sh -c 'exec journalctl -u grademax-relay --cursor-file=/var/lib/relay-log-mirror.cursor -f -o short-iso >> /srv/partner/logs/relay.log'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now relay-log-mirror

cat > /etc/logrotate.d/relay-log-mirror <<'ROT'
/srv/partner/logs/relay.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    copytruncate
}
ROT

# 5. sshd. The Match block goes at the END of the main sshd_config — a Match
#    in sshd_config.d would swallow every directive below Ubuntu's top-of-file
#    Include. The forwarding/tunnel lines matter: without them an SFTP-only
#    user can still use the VPS as a network proxy.
grep -q 'Match User partner' /etc/ssh/sshd_config || cat >> /etc/ssh/sshd_config <<'SSHD'

# grademax partner: monitor-only SFTP jail (VPS_INSTALL.md §8)
Match User partner
    ChrootDirectory /srv/partner
    ForceCommand internal-sftp
    PasswordAuthentication no
    AllowTcpForwarding no
    AllowAgentForwarding no
    X11Forwarding no
    PermitTunnel no
SSHD
sshd -t
systemctl reload ssh || systemctl restart ssh
```

### Give the partner a key

Best: they generate their own (`ssh-keygen -t ed25519`) and send you the
`.pub` (public half only); then, on the VPS:

```bash
install -d -m 700 -o partner -g partner /home/partner/.ssh
echo '<their public key line>' > /home/partner/.ssh/authorized_keys
chown partner:partner /home/partner/.ssh/authorized_keys
chmod 600 /home/partner/.ssh/authorized_keys
```

(sshd reads `authorized_keys` from the real `/home/partner/.ssh` — auth
happens before the chroot, so the jail doesn't need a copy.)

2026-07-28: a working keypair was generated on the Windows machine at
`local/partner-access/partner_ed25519` (gitignored — never commit it). Hand
the private key to the partner over a secure channel, or better, replace it
with a key they generate themselves.

### What the partner does

Any SFTP client — WinSCP or FileZilla (host `187.77.26.253`, user
`partner`, auth by key), or plain:

```bash
sftp -i partner_ed25519 partner@187.77.26.253
sftp> ls              # grademax  logs
sftp> get logs/relay.log
```

SFTP has no true `tail -f`; WinSCP's remote-file refresh/follow is the
workable substitute. For a pure is-it-up check they need no VPS access at
all: `node deploy/check-wss.mjs wss://<relay-domain>` from their own machine.

### Verify the jail (from any machine holding the partner key)

- `sftp` in, `ls /` → only `grademax` and `logs`;
- `get grademax/relay/package.json` works, `put`/`mkdir`/`rm` all fail;
- `ssh partner@… true` yields no shell (the forced SFTP server answers);
- `ssh -N -L 9999:example.com:443 partner@…` is refused (no forwarding).

### Notes / removal

- After re-`scp`ing `relay/`, re-run `chmod -R a+rX /root/grademax` if the
  partner reports permission-denied on new files.
- Full removal: `userdel -r partner`; delete the `Match User partner` block
  from `/etc/ssh/sshd_config` (`sshd -t && systemctl reload ssh`);
  `systemctl disable --now relay-log-mirror`; remove the fstab line and
  `umount /srv/partner/grademax`; `rm -rf /srv/partner`.
