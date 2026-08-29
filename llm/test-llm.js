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

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Перевірка не пройдена: ${message}`);
    }
}

async function main() {
    const templatesPath = path.join(__dirname, 'templates.json');
    const templates = JSON.parse(
        fs.readFileSync(templatesPath, 'utf8')
    );

    assert(
        templates.some(template => template.id === 'other'),
        'templates.json має містити сценарій other'
    );

    const alertMessage =
        'Увага! В Одеській області оголошено повітряну тривогу.';

    const alertEndMessage =
        'В Одеській області оголошено відбій повітряної тривоги.';

    const importantMessage =
        'Адміністрація повідомляє: з 1 вересня змінюється порядок доступу до службових приміщень.';

    const unknownMessage =
        'Сьогодні очікується значне погіршення погоди.';

    console.log('=================================');
    console.log('AITube LLM module test');
    console.log('=================================');
    console.log(`Поріг confidence: ${DEFAULT_CONFIDENCE_THRESHOLD}`);

    await runTest('1. FORWARD', async () => {
        const result = await processMessage({
            text: alertMessage,
            processing: { mode: PROCESSING_MODES.FORWARD }
        });
        assert(result.action === 'forward', 'FORWARD має повернути action=forward');
        return result;
    });

    await runTest('2. TEMPLATE', async () => {
        const result = await processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.TEMPLATE,
                template: templates[0].text
            }
        });
        assert(result.action === 'send', 'TEMPLATE має повернути action=send');
        return result;
    });

    if (!process.env.OPENAI_API_KEY) {
        console.log('\n⚠️ OPENAI_API_KEY не задано.');
        console.log('LLM-тести пропущено.');
        return;
    }

    await runTest('3. LLM GENERATE', async () => {
        const result = await processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_GENERATE,
                instructions: [
                    'Ти редактор службових повідомлень.',
                    'Створи коротке, чітке та унікальне повідомлення на основі вхідного тексту.',
                    'Не вигадуй нових фактів.',
                    'Не змінюй цифри, назви, місця, час або інші конкретні дані.',
                    'Зберігай основний зміст.',
                    'Відповідай українською мовою.',
                    'Поверни тільки готове повідомлення.'
                ].join(' ')
            }
        });
        assert(result.action === 'send', 'LLM GENERATE має повернути action=send');
        assert(Boolean(result.text), 'LLM GENERATE має повернути текст');
        return result;
    });

    await runTest('4. LLM TEMPLATE — AIR ALERT', async () => {
        const result = await processMessage({
            text: alertMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD
            }
        });
        assert(result.templateId === 'air_alert', 'має бути air_alert');
        return result;
    });

    await runTest('5. LLM TEMPLATE — AIR ALERT END', async () => {
        const result = await processMessage({
            text: alertEndMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD
            }
        });
        assert(result.templateId === 'air_alert_end', 'має бути air_alert_end');
        return result;
    });

    await runTest('6. LLM TEMPLATE — IMPORTANT INFORMATION', async () => {
        const result = await processMessage({
            text: importantMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD
            }
        });
        assert(
            result.templateId === 'important_information',
            'має бути important_information'
        );
        return result;
    });

    await runTest('7. LLM TEMPLATE — OTHER → FALLBACK GENERATE', async () => {
        const result = await processMessage({
            text: unknownMessage,
            processing: {
                mode: PROCESSING_MODES.LLM_TEMPLATE,
                templates,
                confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
                fallbackMode: PROCESSING_MODES.LLM_GENERATE
            }
        });

        assert(
            result.action === 'send',
            'fallback має повернути action=send'
        );
        assert(
            result.fallbackMode === PROCESSING_MODES.LLM_GENERATE,
            'має бути fallbackMode=llm_generate'
        );
        assert(
            result.templateId === 'other',
            'класифікація невідомого повідомлення має бути other'
        );
        assert(
            Boolean(result.text),
            'fallback LLM має повернути згенерований текст'
        );

        return result;
    });

    console.log('\n=================================');
    console.log('Усі передбачені тести пройдено.');
    console.log('=================================');
}

main().catch(() => {
    process.exit(1);
});
