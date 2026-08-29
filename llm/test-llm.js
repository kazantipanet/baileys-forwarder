require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
    PROCESSING_MODES,
    DEFAULT_CONFIDENCE_THRESHOLD,
    processMessage
} = require('./processor');


async function runTest(name, fn) {
    try {
        const result = await fn();
        console.log(`\n✅ ${name}`);
        console.dir(result, { depth: null });
        return result;
    } catch (error) {
        console.error(`\n❌ ${name}`);
        console.error(error.message);
        throw error;
    }
}


async function main() {
    const templatesPath = path.join(
        __dirname,
        'templates.json'
    );

    const templates = JSON.parse(
        fs.readFileSync(
            templatesPath,
            'utf8'
        )
    );

    const alertMessage =
        'Увага! В Одеській області оголошено повітряну тривогу.';

    const alertEndMessage =
        'В Одеській області оголошено відбій повітряної тривоги.';

    const importantMessage =
        'Увага! Адміністрація повідомляє про важливі зміни в організації роботи.';

    const unknownMessage =
        'Сьогодні очікується значне погіршення погоди.';

    console.log('=================================');
    console.log('AITube LLM module test');
    console.log('=================================');
    console.log(`Поріг confidence: ${DEFAULT_CONFIDENCE_THRESHOLD}`);

    // 1. Оригінал без змін
    await runTest('1. FORWARD', () =>
        processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.FORWARD
            }
        })
    );

    // 2. Фіксований шаблон
    await runTest('2. TEMPLATE', () =>
        processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.TEMPLATE,
                template: templates[0].text
            }
        })
    );

    // Без API-ключа можна перевірити всі локальні сценарії,
    // але LLM-класифікація/генерація потребують API.
    if (!process.env.OPENAI_API_KEY) {
        console.log('\n⚠️ OPENAI_API_KEY не задано.');
        console.log('LLM-тести пропущено.');
        return;
    }

    // 3. Генерація нового повідомлення
    await runTest('3. LLM GENERATE', () =>
        processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_GENERATE,
                instructions: [
                    'Ти редактор службових повідомлень.',
                    'Створи коротке, чітке та унікальне повідомлення',
                    'на основі вхідного тексту.',
                    'Не вигадуй нових фактів.',
                    'Не змінюй цифри, назви, місця, час або інші конкретні дані.',
                    'Зберігай основний зміст.',
                    'Відповідай українською мовою.',
                    'Поверни тільки готове повідомлення.'
                ].join(' ')
            }
        })
    );

    // 4. LLM-класифікація + шаблон
    await runTest('4. LLM TEMPLATE — AIR ALERT', () =>
        processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD
            }
        })
    );

    await runTest('5. LLM TEMPLATE — AIR ALERT END', () =>
        processMessage({
            text: alertEndMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD
            }
        })
    );

    await runTest('6. LLM TEMPLATE — IMPORTANT INFORMATION', () =>
        processMessage({
            text: importantMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD
            }
        })
    );

    // 7. Незнайомий тип: перевіряємо fallback у LLM_GENERATE.
    await runTest('7. LLM TEMPLATE — UNKNOWN TYPE / FALLBACK GENERATE', () =>
        processMessage({
            text: unknownMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
                fallbackMode: PROCESSING_MODES.LLM_GENERATE
            }
        })
    );
}


main()
    .catch(() => {
        process.exit(1);
    });
