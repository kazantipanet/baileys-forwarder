#!/data/data/com.termux/files/usr/bin/bash

# ============================================================
# AITube WhatsApp Baileys Forwarder
# Запуск програми на Android / Termux
# ============================================================

set -e

APP_DIR="$HOME/baileys-forwarder"

if [ ! -d "$APP_DIR" ]; then
    echo "❌ Програма не встановлена. Спочатку виконайте:"
    echo "   git clone https://github.com/kazantipanet/baileys-forwarder.git"
    echo "   cd baileys-forwarder"
    echo "   bash install.sh"
    exit 1
fi

cd "$APP_DIR"

# Не допускаємо запуску з іншої директорії.
if [ ! -f "index.js" ]; then
    echo "❌ Не знайдено index.js у $APP_DIR"
    exit 1
fi

# Перевіряємо Node.js.
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js не встановлено. Виконайте:"
    echo "   bash install.sh"
    exit 1
fi

# Не даємо Android приспати Termux під час роботи програми.
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock >/dev/null 2>&1 || true
fi

echo ""
echo "========================================"
echo "🚀 AITube WhatsApp Forwarder"
echo "========================================"
echo "📁 Каталог: $APP_DIR"
echo "🌐 Веб-інтерфейс: http://127.0.0.1:3000"
echo ""
echo "Для зупинки програми натисніть Ctrl+C"
echo "========================================"
echo ""

node index.js
