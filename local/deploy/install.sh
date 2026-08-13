#!/usr/bin/env bash
# One-shot installer for the grademax blind relay on a fresh Ubuntu VPS.
# Idempotent — safe to re-run after changing env knobs or updating the code.
#
#   RELAY_DOMAIN=relay.example.org bash /root/grademax/deploy/install.sh
#
# Env knobs (all optional except RELAY_DOMAIN):
#   RELAY_DOMAIN      public DNS name the relay serves — Caddy gets its TLS cert
#                     for this name (e.g. relay.example.org or 203-0-113-7.sslip.io)
#   GRADEMAX_DIR      where the code was copied        (default /root/grademax)
#   ALLOWED_ORIGINS   Origin pin for the relay         (default: scoremap.org origins)
#   NODE_VERSION      Node to install if none >= 22    (default 22.19.0)
#   SKIP_UFW=true     leave the firewall alone
set -euo pipefail

GRADEMAX_DIR="${GRADEMAX_DIR:-/root/grademax}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://www.scoremap.org,https://scoremap.org,https://tshulin.github.io}"
NODE_VERSION="${NODE_VERSION:-22.19.0}"
RELAY_DOMAIN="${RELAY_DOMAIN:?set RELAY_DOMAIN to the public DNS name for the relay, e.g. relay.example.org}"

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
[ -f "$GRADEMAX_DIR/relay/server.mjs" ] || {
	echo "relay code not found at $GRADEMAX_DIR/relay — copy local/relay and local/deploy there first (see VPS_INSTALL.md)" >&2
	exit 1
}

echo "== base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq ca-certificates curl gnupg xz-utils

echo "== node >= 22"
need_node=true
if command -v node >/dev/null 2>&1; then
	[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] && need_node=false
fi
if $need_node; then
	# Official tarball into /usr/local: works on any Ubuntu release, no repo dance.
	case "$(uname -m)" in
		x86_64) arch=x64 ;;
		aarch64) arch=arm64 ;;
		*) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
	esac
	curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz" |
		tar -xJ -C /usr/local --strip-components=1
fi
echo "node $(node -v)"

echo "== caddy (TLS terminator so the browser can reach the relay over wss://)"
if ! command -v caddy >/dev/null 2>&1; then
	apt-get install -yq debian-keyring debian-archive-keyring apt-transport-https
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update -q
	apt-get install -yq caddy
fi

echo "== relay dependencies"
cd "$GRADEMAX_DIR/relay"
npm ci --omit=dev

echo "== config"
cat > /etc/grademax-relay.env <<EOF
PORT=8080
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
TRUST_FORWARDED_FOR=true
EOF

cat > /etc/systemd/system/grademax-relay.service <<EOF
[Unit]
Description=grademax blind relay (WebSocket<->TCP, ciphertext only)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$(command -v node) ${GRADEMAX_DIR}/relay/server.mjs
EnvironmentFile=/etc/grademax-relay.env
Restart=always
RestartSec=2
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
# wss://${RELAY_DOMAIN} -> the relay on localhost. The WebSocket payload is the
# browser<->Edupoint TLS ciphertext, so Caddy — like the relay — can read nothing.
${RELAY_DOMAIN} {
	reverse_proxy 127.0.0.1:8080
}
EOF

echo "== firewall"
if [ "${SKIP_UFW:-}" != "true" ]; then
	apt-get install -yq ufw
	ufw allow 22/tcp
	ufw allow 80/tcp
	ufw allow 443/tcp
	ufw --force enable
fi

echo "== start"
systemctl daemon-reload
systemctl enable --now grademax-relay
systemctl restart caddy
sleep 1
systemctl --no-pager --lines 5 status grademax-relay || true

echo
echo "Done. Next: verify the deployed endpoint end to end:"
echo "  node $GRADEMAX_DIR/deploy/check-wss.mjs wss://${RELAY_DOMAIN}"
