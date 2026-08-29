/**
 * AITube WhatsApp Forwarder
 * Модуль обробки повідомлень через LLM
 *
 * Режими:
 * - forward        — передати оригінальне повідомлення без змін
 * - llm_generate   — згенерувати новий текст через LLM
 * - template       — використати готовий шаблон
 * - llm_template   — визначити відповідний шаблон через LLM
 */

const {
    generateText,
    classifyTemplate
} = require('./openai');


const PROCESSING_MODES = {
    FORWARD: 'forward',
    LLM_GENERATE: 'llm_generate',
    TEMPLATE: 'template',
    LLM_TEMPLATE: 'llm_template'
};


/**
 * Обробляє повідомлення відповідно до налаштувань правила.
 *
 * @param {Object} options
 * @param {string} options.text - Текст вхідного повідомлення.
 * @param {Object} options.processing - Налаштування LLM.
 *
 * @returns {Promise<Object>}
 */
async function processMessage({
    text,
    processing = {}
}) {

    const mode =
        processing.mode ||
        PROCESSING_MODES.FORWARD;


    // --------------------------------------------------
    // РЕЖИМ: ПЕРЕДАЧА БЕЗ ЗМІН
    // --------------------------------------------------

    if (
        mode ===
        PROCESSING_MODES.FORWARD
    ) {

        return {
            action: 'forward',
            mode,
            text
        };
    }


    // --------------------------------------------------
    // ПЕРЕВІРКА ВХІДНОГО ТЕКСТУ
    // --------------------------------------------------

    if (
        !text ||
        !String(text).trim()
    ) {

        return {
            action: 'skip',
            mode,
            reason:
                'Повідомлення не містить тексту для LLM-обробки.'
        };
    }


    // --------------------------------------------------
    // РЕЖИМ: ГЕНЕРАЦІЯ НОВОГО ТЕКСТУ
    // --------------------------------------------------

    if (
        mode ===
        PROCESSING_MODES.LLM_GENERATE
    ) {

        const result =
            await generateText({

                input:
                    text,

                instructions:
                    processing.instructions ||
                    [
                        'Створи нове унікальне повідомлення',
                        'на основі вхідного тексту.',
                        'Не додавай неперевірені факти.',
                        'Зберігай зміст та ключові факти.',
                        'Відповідай українською мовою.',
                        'Не пояснюй свою роботу.',
                        'Поверни лише готовий текст повідомлення.'
                    ].join(' '),

                model:
                    processing.model,

                apiKey:
                    processing.apiKey
            });


        return {
            action: 'send',
            mode,
            text: result.text,
            model: result.model,
            responseId: result.responseId
        };
    }


    // --------------------------------------------------
    // РЕЖИМ: ГОТОВИЙ ШАБЛОН
    // --------------------------------------------------

    if (
        mode ===
        PROCESSING_MODES.TEMPLATE
    ) {

        if (
            !processing.template
        ) {

            throw new Error(
                'Для режиму template не задано шаблон.'
            );
        }


        return {
            action: 'send',
            mode,
            text:
                processing.template
        };
    }


    // --------------------------------------------------
    // РЕЖИМ: LLM + ШАБЛОН
    // --------------------------------------------------

    if (
        mode ===
        PROCESSING_MODES.LLM_TEMPLATE
    ) {

        const templates =
            Array.isArray(
                processing.templates
            )
                ? processing.templates
                : [];


        const result =
            await classifyTemplate({

                input:
                    text,

                templates,

                instructions:
                    processing.instructions,

                model:
                    processing.model,

                apiKey:
                    processing.apiKey
            });


        if (
            !result.template
        ) {

            return {
                action: 'fallback',
                mode,
                text,
                confidence:
                    result.confidence,
                reason:
                    'LLM не знайшла відповідний шаблон.'
            };
        }


        return {
            action: 'send',
            mode,
            text:
                result.template.text,

            templateId:
                result.template.id,

            templateName:
                result.template.name,

            confidence:
                result.confidence,

            model:
                result.model,

            responseId:
                result.responseId
        };
    }


    // --------------------------------------------------
    // НЕВІДОМИЙ РЕЖИМ
    // --------------------------------------------------

    throw new Error(
        `Невідомий режим LLM-обробки: ${mode}`
    );
}


module.exports = {
    PROCESSING_MODES,
    processMessage
};