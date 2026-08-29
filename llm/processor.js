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

const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;


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
                        'Не змінюй цифри, назви, місця, час або інші конкретні дані.',
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

        if (templates.length === 0) {
            throw new Error(
                'Для режиму llm_template не задано жодного шаблону.'
            );
        }

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

        const confidenceThreshold = Math.max(
            0,
            Math.min(
                1,
                Number(
                    processing.confidenceThreshold ??
                    DEFAULT_CONFIDENCE_THRESHOLD
                )
            )
        );

        const hasConfidentTemplate =
            Boolean(result.template) &&
            result.confidence >= confidenceThreshold;

        if (hasConfidentTemplate) {
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

                confidenceThreshold,

                model:
                    result.model,

                responseId:
                    result.responseId
            };
        }

        // За замовчуванням низька впевненість не призводить
        // до пересилання оригінального повідомлення.
        // Натомість генеруємо новий текст через LLM.
        const fallbackMode =
            processing.fallbackMode ||
            PROCESSING_MODES.LLM_GENERATE;

        if (
            fallbackMode ===
            PROCESSING_MODES.LLM_GENERATE
        ) {
            const generated =
                await generateText({
                    input: text,
                    instructions:
                        processing.fallbackInstructions ||
                        [
                            'Створи коротке унікальне повідомлення',
                            'на основі вхідного тексту.',
                            'Не вигадуй і не змінюй факти.',
                            'Не змінюй цифри, назви, місця, час або інші конкретні дані.',
                            'Відповідай українською мовою.',
                            'Поверни тільки готове повідомлення.'
                        ].join(' '),
                    model: processing.model,
                    apiKey: processing.apiKey
                });

            return {
                action: 'send',
                mode,
                fallbackMode,
                text: generated.text,
                confidence: result.confidence,
                confidenceThreshold,
                templateId: result.template?.id || null,
                model: generated.model,
                responseId: generated.responseId
            };
        }

        if (fallbackMode === 'skip') {
            return {
                action: 'skip',
                mode,
                text: null,
                confidence: result.confidence,
                confidenceThreshold,
                reason:
                    'Немає шаблону з достатньою впевненістю LLM.'
            };
        }

        throw new Error(
            `Невідомий fallbackMode для llm_template: ${fallbackMode}`
        );
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
    DEFAULT_CONFIDENCE_THRESHOLD,
    processMessage
};
