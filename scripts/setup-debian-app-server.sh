#!/usr/bin/env bash
set -Eeuo pipefail

CHECK_ONLY=0
SKIP_APT_UPDATE=0
SKIP_SYSTEM_INSTALL=0
SKIP_VENV_CREATE=0
SKIP_PIP_INSTALL=0
SKIP_NPM_INSTALL=0
INSTALL_PLAYWRIGHT=0
PLAYWRIGHT_WITH_DEPS=0
SKIP_QUICK_VERIFY=0
SKIP_GH_AUTH_CHECK=0
VENV_DIR=".venv"
PYTHON_BIN="python3"
NODE_MIN_MAJOR=18
NODESOURCE_MAJOR=20

write_step() {
  printf '\n==> %s\n' "$1"
}

write_ok() {
  printf '[OK] %s\n' "$1"
}

write_warn() {
  printf '[WARN] %s\n' "$1"
}

usage() {
  cat <<'USAGE'
Usage: bash setup-debian-app-server.sh [options]

Options:
  --check-only            Chi kiem tra moi truong, khong cai dat
  --skip-apt-update       Bo qua apt-get update
  --skip-system-install   Bo qua cai dat package he thong (python/node/gh)
  --skip-venv-create      Bo qua tao virtualenv
  --skip-pip-install      Bo qua cai requirements.txt
  --skip-npm-install      Bo qua npm ci / npm install
  --install-playwright    Cai them Playwright + Chromium
  --playwright-with-deps  Cai Playwright Chromium kem system deps (khuyen nghi tren Debian)
  --skip-quick-verify     Bo qua quick verify
  --skip-gh-auth-check    Bo qua kiem tra gh auth status
  --venv-dir PATH         Thu muc virtualenv (mac dinh: .venv)
  --python-bin BIN        Lenh python su dung (mac dinh: python3)
  --node-major N          Node.js major version can dam bao (mac dinh: 18)
  -h, --help              Hien tro giup

Examples:
  bash setup-debian-app-server.sh
  bash setup-debian-app-server.sh --install-playwright --playwright-with-deps
  bash setup-debian-app-server.sh --check-only
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --skip-apt-update) SKIP_APT_UPDATE=1 ;;
    --skip-system-install) SKIP_SYSTEM_INSTALL=1 ;;
    --skip-venv-create) SKIP_VENV_CREATE=1 ;;
    --skip-pip-install) SKIP_PIP_INSTALL=1 ;;
    --skip-npm-install) SKIP_NPM_INSTALL=1 ;;
    --install-playwright) INSTALL_PLAYWRIGHT=1 ;;
    --playwright-with-deps)
      INSTALL_PLAYWRIGHT=1
      PLAYWRIGHT_WITH_DEPS=1
      ;;
    --skip-quick-verify) SKIP_QUICK_VERIFY=1 ;;
    --skip-gh-auth-check) SKIP_GH_AUTH_CHECK=1 ;;
    --venv-dir)
      shift
      VENV_DIR="${1:-}"
      ;;
    --python-bin)
      shift
      PYTHON_BIN="${1:-}"
      ;;
    --node-major)
      shift
      NODE_MIN_MAJOR="${1:-}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Tham so khong hop le: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1
}

python_version_ok() {
  "$PYTHON_BIN" - <<'PY'
import sys
sys.exit(0 if sys.version_info >= (3, 11) else 1)
PY
}

node_version_ok() {
  local current_major
  current_major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$current_major" =~ ^[0-9]+$ ]] && (( current_major >= NODE_MIN_MAJOR ))
}

get_python_version() {
  "$PYTHON_BIN" -c 'import sys; print(".".join(map(str, sys.version_info[:3])))'
}

get_node_version() {
  node -p 'process.versions.node'
}

ensure_sudo_mode() {
  if (( EUID == 0 )); then
    SUDO=""
    return
  fi
  if require_command sudo; then
    SUDO="sudo"
    return
  fi
  printf 'Can sudo hoac chay bang root de cai dat package he thong.\n' >&2
  exit 1
}

setup_apt_base() {
  ensure_sudo_mode
  if (( SKIP_APT_UPDATE == 0 )); then
    write_step "Cap nhat apt package index"
    $SUDO apt-get update
    write_ok "Da cap nhat apt package index."
  else
    write_warn "Bo qua apt-get update theo tham so."
  fi

  write_step "Cai base packages cho Debian"
  $SUDO apt-get install -y ca-certificates curl gnupg lsb-release apt-transport-https
  write_ok "Base packages da san sang."
}

install_python_runtime() {
  setup_apt_base
  write_step "Cai Python runtime cho app server"
  $SUDO apt-get install -y python3 python3-venv python3-pip
  write_ok "Python runtime da san sang."
}

setup_nodesource_repo() {
  local keyring distro codename repo_line list_file
  keyring="/etc/apt/keyrings/nodesource.gpg"
  list_file="/etc/apt/sources.list.d/nodesource.list"
  distro="$(. /etc/os-release && echo "${ID:-debian}")"
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  if [[ -z "$codename" ]]; then
    codename="nodistro"
  fi

  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | $SUDO gpg --dearmor -o "$keyring"
  $SUDO chmod a+r "$keyring"
  repo_line="deb [signed-by=$keyring] https://deb.nodesource.com/node_${NODESOURCE_MAJOR}.x $codename main"
  printf '%s\n' "$repo_line" | $SUDO tee "$list_file" >/dev/null
  if [[ "$distro" != "debian" ]]; then
    write_warn "OS detect la $distro. Script van thu dung repo NodeSource theo codename: $codename"
  fi
}

install_node_runtime() {
  setup_apt_base
  ensure_sudo_mode
  write_step "Cau hinh NodeSource repo cho Node.js ${NODESOURCE_MAJOR}.x"
  setup_nodesource_repo
  write_step "Cap nhat apt package index cho NodeSource"
  $SUDO apt-get update
  write_step "Cai Node.js va npm"
  $SUDO apt-get install -y nodejs
  write_ok "Node.js va npm da san sang."
}

setup_github_cli_repo() {
  local keyring list_file arch
  keyring="/etc/apt/keyrings/githubcli-archive-keyring.gpg"
  list_file="/etc/apt/sources.list.d/github-cli.list"
  arch="$(dpkg --print-architecture)"

  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | $SUDO dd of="$keyring" status=none
  $SUDO chmod go+r "$keyring"
  printf 'deb [arch=%s signed-by=%s] https://cli.github.com/packages stable main\n' "$arch" "$keyring" | $SUDO tee "$list_file" >/dev/null
}

install_github_cli() {
  setup_apt_base
  ensure_sudo_mode
  write_step "Cau hinh GitHub CLI apt repo"
  setup_github_cli_repo
  write_step "Cap nhat apt package index cho GitHub CLI"
  $SUDO apt-get update
  write_step "Cai GitHub CLI"
  $SUDO apt-get install -y gh
  write_ok "GitHub CLI da san sang."
}

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || true)"
if [[ -z "$repo_root" || ! -d "$repo_root" ]]; then
  repo_root="$(pwd)"
fi
cd "$repo_root"

write_step "Kiem tra Python cho app server"
need_python_install=0
if require_command "$PYTHON_BIN"; then
  current_py="$(get_python_version)"
  if python_version_ok; then
    write_ok "Python da dat yeu cau: $current_py"
  else
    write_warn "Python hien tai la $current_py, can 3.11 tro len."
    need_python_install=1
  fi
else
  write_warn "Khong tim thay $PYTHON_BIN trong PATH."
  need_python_install=1
fi

write_step "Kiem tra Node.js va npm"
need_node_install=0
if require_command node && require_command npm; then
  current_node="$(get_node_version)"
  if node_version_ok; then
    write_ok "Node.js da dat yeu cau: $current_node"
    write_ok "npm da san sang: $(npm --version)"
  else
    write_warn "Node.js hien tai la $current_node, can major >= $NODE_MIN_MAJOR."
    need_node_install=1
  fi
else
  write_warn "Khong tim thay node/npm trong PATH."
  need_node_install=1
fi

write_step "Kiem tra GitHub CLI"
need_gh_install=0
if require_command gh; then
  write_ok "GitHub CLI da san sang: $(gh --version | head -n 1)"
else
  write_warn "Khong tim thay gh trong PATH."
  need_gh_install=1
fi

if (( CHECK_ONLY == 1 )); then
  if (( need_python_install == 1 )); then
    write_warn "Can cai python3, python3-venv, python3-pip."
  fi
  if (( need_node_install == 1 )); then
    write_warn "Can cai Node.js va npm."
  fi
  if (( need_gh_install == 1 )); then
    write_warn "Can cai GitHub CLI (gh)."
  fi
  if [[ -f requirements.txt ]]; then
    write_ok "Tim thay requirements.txt"
  else
    write_warn "Khong tim thay requirements.txt, script se bo qua buoc pip install neu file nay khong ton tai."
  fi
  if [[ -f package.json ]]; then
    write_ok "Tim thay package.json"
  else
    write_warn "Khong tim thay package.json, script se bo qua npm install neu file nay khong ton tai."
  fi
  if [[ -f app.py ]]; then
    write_ok "Tim thay app.py"
  else
    write_warn "Khong tim thay app.py tai repo root hien tai: $repo_root"
  fi
  if (( INSTALL_PLAYWRIGHT == 1 )); then
    write_warn "Che do check-only: Playwright chua duoc cai."
  fi
  write_step "Check-only summary"
  printf 'Script dang chay o che do chi kiem tra. Khong co thay doi nao duoc ap dung.\n'
  exit 0
fi

if (( SKIP_SYSTEM_INSTALL == 0 )); then
  if (( need_python_install == 1 )); then
    install_python_runtime
  fi
  if (( need_node_install == 1 )); then
    install_node_runtime
  fi
  if (( need_gh_install == 1 )); then
    install_github_cli
  fi
else
  if (( need_python_install == 1 || need_node_install == 1 || need_gh_install == 1 )); then
    write_warn "Dang bo qua cai dat package he thong theo tham so --skip-system-install."
  fi
fi

if ! require_command "$PYTHON_BIN"; then
  printf 'Khong tim thay %s sau buoc cai dat.\n' "$PYTHON_BIN" >&2
  exit 1
fi
if ! python_version_ok; then
  printf 'Python sau cai dat van chua dat yeu cau >= 3.11. Hien tai: %s\n' "$(get_python_version)" >&2
  exit 1
fi
if ! require_command node || ! require_command npm; then
  printf 'Khong tim thay node/npm sau buoc cai dat.\n' >&2
  exit 1
fi
if ! node_version_ok; then
  printf 'Node.js sau cai dat van chua dat yeu cau >= %s. Hien tai: %s\n' "$NODE_MIN_MAJOR" "$(get_node_version)" >&2
  exit 1
fi
if ! require_command gh; then
  printf 'Khong tim thay GitHub CLI (gh) sau buoc cai dat.\n' >&2
  exit 1
fi

write_ok "Python da san sang: $(get_python_version)"
write_ok "Node.js da san sang: $(get_node_version)"
write_ok "npm da san sang: $(npm --version)"
write_ok "GitHub CLI da san sang: $(gh --version | head -n 1)"

VENV_PYTHON="$PYTHON_BIN"
if (( SKIP_VENV_CREATE == 0 )); then
  write_step "Tao virtualenv"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  VENV_PYTHON="$repo_root/$VENV_DIR/bin/python"
  write_ok "Virtualenv da san sang: $VENV_DIR"
else
  write_warn "Bo qua tao virtualenv theo tham so."
fi

if (( SKIP_PIP_INSTALL == 0 )); then
  if [[ -f requirements.txt ]]; then
    write_step "Cai Python dependencies"
    "$VENV_PYTHON" -m pip install --upgrade pip
    "$VENV_PYTHON" -m pip install -r requirements.txt
    write_ok "Python dependencies da san sang."
  else
    write_warn "Khong tim thay requirements.txt, bo qua pip install."
  fi
else
  write_warn "Bo qua pip install theo tham so."
fi

if (( SKIP_NPM_INSTALL == 0 )); then
  if [[ -f package-lock.json ]]; then
    write_step "Cai npm dependencies bang npm ci"
    npm ci
    write_ok "npm dependencies da san sang."
  elif [[ -f package.json ]]; then
    write_step "Cai npm dependencies bang npm install"
    npm install
    write_ok "npm dependencies da san sang."
  else
    write_warn "Khong tim thay package.json, bo qua npm install."
  fi
else
  write_warn "Bo qua npm install theo tham so."
fi

if (( INSTALL_PLAYWRIGHT == 1 )); then
  if [[ -f package.json ]]; then
    if node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));const deps={...(p.dependencies||{}),...(p.devDependencies||{})};process.exit(deps["@playwright/test"]||deps["playwright"]?0:1)'; then
      write_ok "Playwright package da co san trong package.json"
    else
      write_step "Cai them @playwright/test vao project"
      npm install -D @playwright/test
      write_ok "@playwright/test da duoc them vao project."
    fi

    write_step "Cai Playwright Chromium"
    if (( PLAYWRIGHT_WITH_DEPS == 1 )); then
      npx playwright install --with-deps chromium
    else
      npx playwright install chromium
    fi
    write_ok "Playwright Chromium da san sang."
  else
    write_warn "Khong tim thay package.json, bo qua cai Playwright."
  fi
fi

if (( SKIP_QUICK_VERIFY == 0 )); then
  write_step "Chay quick verify"
  if [[ -f app.py ]]; then
    "$VENV_PYTHON" -m py_compile app.py
    write_ok "Quick verify Python thanh cong voi app.py"
  else
    write_warn "Khong tim thay app.py, bo qua py_compile."
  fi

  if [[ -f static/app.js ]]; then
    node --check static/app.js
    write_ok "Quick verify Node thanh cong voi static/app.js"
  else
    write_warn "Khong tim thay static/app.js, bo qua node --check."
  fi
else
  write_warn "Bo qua quick verify theo tham so."
fi

if (( SKIP_GH_AUTH_CHECK == 0 )); then
  write_step "Kiem tra dang nhap GitHub CLI"
  if gh auth status >/dev/null 2>&1; then
    write_ok "GitHub CLI da auth."
  else
    write_warn "gh da duoc cai nhung chua auth. Chay: gh auth login"
  fi
else
  write_warn "Bo qua kiem tra gh auth theo tham so."
fi

write_step "Hoan tat setup"
printf 'Kich hoat virtualenv: source %s/bin/activate\n' "$VENV_DIR"
printf 'Chay app server: %s app.py\n' "$VENV_PYTHON"
printf 'Neu can test integration bang Chromium: npx playwright test\n'
printf 'Script co the chay lai nhieu lan mot cach an toan.\n'
