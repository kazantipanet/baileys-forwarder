require('dotenv').config();

const {
    classifyTemplateWithVariables
} = require('./openai');

const {
    loadTemplates
} = require('./templates');

const templates = loadTemplates();

const CONFIDENCE_THRESHOLD = Number(
    process.env.LLM_CONFIDENCE_THRESHOLD || 0.85
);

/**
 * Підстановка змінних у шаблон.
 *
 * Наприклад:
 *
 * template:
 * "БпЛА в бік міста {{destination}}"
 *
 * variables:
 * { destination: "Одеси" }
 *
 * результат:
 * "БпЛА в бік міста Одеси"
 */
function renderTemplate(templateText, variables = {}) {
    if (!templateText) {
        return '';
    }

    return String(templateText).replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (match, variableName) => {
            const value = variables[variableName];

            if (
                value === null ||
                value === undefined ||
                String(value).trim() === ''
            ) {
                return match;
            }

            return String(value).trim();
        }
    );
}

/**
 * Перевіряє, чи всі необхідні змінні шаблону
 * реально отримані від LLM.
 */
function getMissingVariables(template, variables = {}) {
    if (!template || !Array.isArray(template.variables)) {
        return [];
    }

    return template.variables.filter(variable => {
        const value = variables[variable];

        return (
            value === null ||
            value === undefined ||
            String(value).trim() === ''
        );
    });
}

/**
 * Повна обробка вхідного повідомлення.
 *
 * Алгоритм:
 *
 * 1. LLM визначає шаблон.
 * 2. LLM витягує змінні.
 * 3. Перевіряємо confidence.
 * 4. Перевіряємо наявність усіх змінних.
 * 5. Якщо все добре — формуємо повідомлення із шаблону.
 * 6. Якщо confidence низький або змінних недостатньо —
 *    повідомлення не відправляється.
 */
async function processMessage(input, options = {}) {
    /*
     * ============================================================
     * AITube V2 — TEMPLATE ONLY PROCESSOR
     * ============================================================
     *
     * Логіка:
     *
     * 1. Отримуємо текст.
     * 2. LLM аналізує ВСЕ повідомлення.
     * 3. LLM обирає найбільш відповідний шаблон.
     * 4. LLM витягує змінні саме для цього шаблону.
     * 5. Перевіряємо confidence.
     * 6. Перевіряємо обов'язкові змінні.
     * 7. Формуємо повідомлення виключно через шаблон.
     *
     * ВАЖЛИВО:
     *
     * - немає llm_generate fallback;
     * - якщо шаблон не знайдено → SKIP;
     * - якщо confidence низький → SKIP;
     * - якщо змінних недостатньо → SKIP;
     * - LLM не має права вигадувати дані;
     * - LLM повинна враховувати весь зміст вхідного повідомлення.
     */

    if (!input || !String(input).trim()) {
        throw new Error(
            'Processor отримав порожнє повідомлення.'
        );
    }

    /*
     * Підтримуємо обидва варіанти:
     *
     * processMessage("текст")
     *
     * і старий формат:
     *
     * processMessage({
     *     text: "текст",
     *     ...
     * })
     */

    let text = '';

    if (typeof input === 'string') {
        text = input.trim();
    } else if (
        input &&
        typeof input === 'object' &&
        input.text
    ) {
        text = String(input.text).trim();
    }

    if (!text) {
        throw new Error(
            'Processor не отримав текст повідомлення.'
        );
    }

    const model =
        options.model ||
        process.env.OPENAI_MODEL ||
        'gpt-5';

    const apiKey =
        options.apiKey ||
        process.env.OPENAI_API_KEY;

    /*
     * ============================================================
     * CLASSIFICATION
     * ============================================================
     *
     * classifyTemplateWithVariables() вже відповідає за:
     *
     * - вибір шаблону;
     * - confidence;
     * - витягування variables.
     *
     * Але тепер processor трактує результат суворо:
     * тільки шаблонне повідомлення може бути SEND.
     */

    const classification =
        await classifyTemplateWithVariables({
            input: text,
            templates,
            model,
            apiKey
        });

    const template =
        classification?.template || null;

    const confidence =
        Number(
            classification?.confidence ?? 0
        );

    const variables =
        classification?.variables || {};

    /*
     * ============================================================
     * NO TEMPLATE → SKIP
     * ============================================================
     */

    if (!template) {

        console.log(
            '🛡️ LLM FILTER: шаблон не знайдено → SKIP'
        );

        return {
            action: 'skip',

            mode: 'no_template',

            text,

            confidence,

            confidenceThreshold:
                CONFIDENCE_THRESHOLD,

            templateId: null,

            templateName: null,

            variables: {},

            reason:
                'no_matching_template',

            model,

            responseId:
                classification?.responseId ||
                null
        };
    }

    /*
     * ============================================================
     * LOW CONFIDENCE → SKIP
     * ============================================================
     */

    if (
        confidence <
        CONFIDENCE_THRESHOLD
    ) {

        console.log(
            '🛡️ LLM FILTER: низький confidence → SKIP'
        );

        return {
            action: 'skip',

            mode: 'low_confidence',

            text,

            confidence,

            confidenceThreshold:
                CONFIDENCE_THRESHOLD,

            templateId:
                template.id,

            templateName:
                template.name,

            variables,

            reason:
                'confidence_below_threshold',

            model,

            responseId:
                classification?.responseId ||
                null
        };
    }

    /*
     * ============================================================
     * CHECK REQUIRED VARIABLES
     * ============================================================
     */

    const missingVariables =
        getMissingVariables(
            template,
            variables
        );

    if (
        missingVariables.length > 0
    ) {

        console.log(
            '🛡️ LLM FILTER: відсутні обов’язкові змінні → SKIP'
        );

        console.log(
            'Шаблон:',
            template.name ||
            template.id
        );

        console.log(
            'Відсутні:',
            missingVariables
        );

        return {
            action: 'skip',

            mode: 'missing_variables',

            text,

            confidence,

            confidenceThreshold:
                CONFIDENCE_THRESHOLD,

            templateId:
                template.id,

            templateName:
                template.name,

            variables,

            missingVariables,

            reason:
                'missing_required_variables',

            model,

            responseId:
                classification?.responseId ||
                null
        };
    }

    /*
     * ============================================================
     * TEMPLATE TEXT
     * ============================================================
     */

    const templateText =
        template.text ||
        template.template ||
        '';

    if (!templateText) {

        throw new Error(
            `Шаблон "${template.id}" не містить тексту.`
        );
    }

    /*
     * ============================================================
     * RENDER
     * ============================================================
     */

    const renderedText =
        renderTemplate(
            templateText,
            variables
        );

    /*
     * ============================================================
     * PROTECTION AGAINST UNRESOLVED VARIABLES
     * ============================================================
     */

    if (
        /\{\{[^}]+\}\}/.test(
            renderedText
        )
    ) {

        throw new Error(
            `Не всі змінні були підставлені у шаблон "${template.id}".`
        );
    }

    /*
     * ============================================================
     * EMPTY RESULT PROTECTION
     * ============================================================
     */

    if (
        !renderedText ||
        !String(renderedText).trim()
    ) {

        throw new Error(
            `Шаблон "${template.id}" сформував порожній текст.`
        );
    }

    /*
     * ============================================================
     * SEND
     * ============================================================
     */

    console.log(
        '✅ LLM FILTER: шаблон підтверджено → SEND'
    );

    console.log(
        '📋 Шаблон:',
        template.name ||
        template.id
    );

    console.log(
        '📊 Confidence:',
        confidence
    );

    console.log(
        '📤 Фінальний текст:',
        renderedText
    );

    return {
        action: 'send',

        mode: 'llm_template',

        text:
            renderedText,

        templateId:
            template.id,

        templateName:
            template.name,

        variables,

        confidence,

        confidenceThreshold:
            CONFIDENCE_THRESHOLD,

        model,

        responseId:
            classification?.responseId ||
            null
    };
}

module.exports = {
    processMessage,
    renderTemplate,
    getMissingVariables
};