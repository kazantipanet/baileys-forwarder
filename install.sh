#!/data/data/com.termux/files/usr/bin/bash

# ============================================================
# AITube WhatsApp Baileys Forwarder
# Автоматичне встановлення на Android / Termux
# Автор: AITube
# ============================================================

set -e

REPO_URL="https://github.com/kazantipanet/baileys-forwarder.git"
APP_DIR="$HOME/baileys-forwarder"

echo ""
echo "========================================"
echo "📦 AITube WhatsApp Forwarder"
echo "🚀 Автоматичне встановлення"
echo "========================================"
echo ""

# Перевіряємо, що скрипт запускається саме в Termux.
if [ -z "${PREFIX:-}" ] || [ ! -d "$PREFIX" ]; then
    echo "❌ Цей установник призначений для Android / Termux."
    exit 1
fi

# Оновлюємо список пакетів.
echo "🔄 Оновлення пакетів Termux..."
pkg update -y

# Встановлюємо необхідні системні пакети.
echo "📦 Перевірка Git та Node.js..."
pkg install -y git nodejs-lts

echo ""
echo "Node.js: $(node --version)"
echo "npm:     $(npm --version)"
echo ""

# Якщо програма вже встановлена, оновлюємо її з GitHub.
if [ -d "$APP_DIR/.git" ]; then
    echo "🔄 Програма вже встановлена. Оновлюю код з GitHub..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "📥 Завантаження AITube WhatsApp Forwarder з GitHub..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Встановлюємо залежності Node.js.
echo ""
echo "📦 Встановлення залежностей Node.js..."
npm install

# Створюємо папку для локальної WhatsApp-сесії.
# Вона не публікується в GitHub.
mkdir -p "$APP_DIR/auth_info"

# Дозволяємо Termux працювати у фоні, якщо доступна відповідна команда.
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock >/dev/null 2>&1 || true
fi

# Перевіряємо синтаксис основного файлу.
echo ""
echo "🔍 Перевірка коду..."
node --check index.js

echo ""
echo "========================================"
echo "✅ ВСТАНОВЛЕННЯ ЗАВЕРШЕНО"
echo "========================================"
echo ""
echo "📁 Програма: $APP_DIR"
echo "🌐 Веб-інтерфейс: http://127.0.0.1:3000"
echo ""
echo "Для запуску виконайте:"
echo ""
echo "    cd ~/baileys-forwarder"
echo "    bash start.sh"
echo ""
echo "Під час першого запуску відскануйте QR-код у WhatsApp."
echo "========================================"
