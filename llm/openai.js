require('dotenv').config();

const OpenAI = require('openai');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const DEFAULT_TIMEOUT_MS = Number(
    process.env.OPENAI_TIMEOUT_MS || 30000
);

let client = null;

function getClient(apiKey) {
    const key = apiKey || process.env.OPENAI_API_KEY;

    if (!key) {
        throw new Error(
            'OPENAI_API_KEY не налаштовано. Додайте API-ключ у змінну середовища.'
        );
    }

    if (!client || apiKey) {
        client = new OpenAI({
            apiKey: key,
            timeout: DEFAULT_TIMEOUT_MS,
            maxRetries: 2
        });
    }

    return client;
}

/**
 * Генерація нового повідомлення.
 */
async function generateText({
    input,
    instructions,
    model = DEFAULT_MODEL,
    apiKey
}) {
    if (!input || !String(input).trim()) {
        throw new Error(
            'LLM отримав порожній текст повідомлення.'
        );
    }

    const response = await getClient(apiKey).responses.create({
        model,
        instructions,
        input: String(input),
        store: false
    });

    const text = response.output_text?.trim();

    if (!text) {
        throw new Error(
            'LLM не повернула текстовий результат.'
        );
    }

    return {
        text,
        responseId: response.id || null,
        model
    };
}

/**
 * Визначення шаблону без змінних.
 */
async function classifyTemplate({
    input,
    templates,
    instructions,
    model = DEFAULT_MODEL,
    apiKey
}) {
    if (!input || !String(input).trim()) {
        throw new Error(
            'LLM отримав порожній текст повідомлення.'
        );
    }

    if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error(
            'Не налаштовано жодного шаблону.'
        );
    }

    const templateList = templates.map(template => ({
        id: template.id,
        name: template.name,
        category: template.category,
        variables: template.variables || [],
        template: template.template
    }));

    const response = await getClient(apiKey).responses.create({
        model,
        instructions:
            instructions ||
            [
                'Ти класифікатор повідомлень.',
                'Визнач, який із наданих шаблонів найкраще відповідає змісту вхідного повідомлення.',
                'Не вигадуй нових template_id.',
                'Якщо жоден шаблон не відповідає змісту, поверни template_id = null.',
                'Орієнтуйся виключно на зміст вхідного повідомлення.',
                'Не змінюй і не вигадуй факти.'
            ].join(' '),
        input: JSON.stringify({
            message: String(input),
            templates: templateList
        }),
        text: {
            format: {
                type: 'json_schema',
                name: 'template_selection',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        template_id: {
                            type: ['string', 'null']
                        },
                        confidence: {
                            type: 'number'
                        }
                    },
                    required: [
                        'template_id',
                        'confidence'
                    ],
                    additionalProperties: false
                }
            }
        },
        store: false
    });

    const raw = response.output_text?.trim();

    if (!raw) {
        throw new Error(
            'LLM не повернула результат класифікації.'
        );
    }

    let result;

    try {
        result = JSON.parse(raw);
    } catch (error) {
        throw new Error(
            `LLM повернула некоректний JSON: ${error.message}`
        );
    }

    const selected = templates.find(
        template => template.id === result.template_id
    );

    return {
        template: selected || null,
        confidence: Math.max(
            0,
            Math.min(
                1,
                Number(result.confidence) || 0
            )
        ),
        responseId: response.id || null,
        model
    };
}

/**
 * Визначення шаблону + витягування змінних.
 *
 * LLM повертає variables як масив:
 *
 * {
 *   "name": "destination",
 *   "value": "Одеси"
 * }
 *
 * Після перевірки цей модуль перетворює його
 * у звичайний об'єкт:
 *
 * {
 *   destination: "Одеси"
 * }
 *
 * Важливо:
 * LLM НЕ має права вигадувати значення.
 */
async function classifyTemplateWithVariables({
    input,
    templates,
    instructions,
    model = DEFAULT_MODEL,
    apiKey
}) {
    if (!input || !String(input).trim()) {
        throw new Error(
            'LLM отримав порожній текст повідомлення.'
        );
    }

    if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error(
            'Не налаштовано жодного шаблону.'
        );
    }

    const templateList = templates.map(template => ({
        id: template.id,
        name: template.name,
        category: template.category,
        variables: template.variables || [],
        template: template.template
    }));

    const response = await getClient(apiKey).responses.create({
        model,
        instructions:
            instructions ||
            [
                'Ти система класифікації повідомлень та структурованого вилучення даних.',

                'Твоє завдання:',
                '1. Визначити найкращий шаблон для вхідного повідомлення.',
                '2. Витягнути значення змінних цього шаблону безпосередньо з вхідного повідомлення.',

                '',
                'КРИТИЧНІ ПРАВИЛА:',
                '1. Не вигадуй факти.',
                '2. Не вигадуй значення змінних.',
                '3. Значення змінних можна брати ТІЛЬКИ з вхідного повідомлення.',
                '4. Якщо потрібної інформації немає у вхідному повідомленні — value = null.',
                '5. Не використовуй власні припущення.',
                '6. Не змінюй числові значення.',
                '7. Не змінюй назви населених пунктів.',
                '8. Не змінюй час або дату.',
                '9. Не додавай інформацію, якої немає у вхідному повідомленні.',
                '10. Не вигадуй нових template_id.',
                '11. Якщо жоден шаблон не відповідає повідомленню — template_id = null.',
                '12. Для кожної змінної використовуй тільки фактичне значення з повідомлення.',
                '13. Якщо шаблон не має змінних — поверни порожній масив variables.',
                '14. Якщо значення змінної відсутнє — поверни її з value = null.',
                '15. Не додавай змінні, яких немає у списку variables вибраного шаблону.',
                '16. Відповідай тільки у визначеному JSON-форматі.'
            ].join('\n'),
        input: JSON.stringify({
            message: String(input),
            templates: templateList
        }),
        text: {
            format: {
                type: 'json_schema',
                name: 'template_with_variables',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        template_id: {
                            type: ['string', 'null']
                        },
                        confidence: {
                            type: 'number'
                        },
                        variables: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: {
                                        type: 'string'
                                    },
                                    value: {
                                        type: ['string', 'null']
                                    }
                                },
                                required: [
                                    'name',
                                    'value'
                                ],
                                additionalProperties: false
                            }
                        }
                    },
                    required: [
                        'template_id',
                        'confidence',
                        'variables'
                    ],
                    additionalProperties: false
                }
            }
        },
        store: false
    });

    const raw = response.output_text?.trim();

    if (!raw) {
        throw new Error(
            'LLM не повернула результат класифікації.'
        );
    }

    let result;

    try {
        result = JSON.parse(raw);
    } catch (error) {
        throw new Error(
            `LLM повернула некоректний JSON: ${error.message}`
        );
    }

    const selected = templates.find(
        template => template.id === result.template_id
    );

    const confidence = Math.max(
        0,
        Math.min(
            1,
            Number(result.confidence) || 0
        )
    );

    /*
     * Дозволені змінні визначаються виключно
     * самим шаблоном.
     */
    const allowedVariables = new Set(
        selected?.variables || []
    );

    const returnedVariables = Array.isArray(
        result.variables
    )
        ? result.variables
        : [];

    const variables = {};

    /*
     * Додаємо тільки ті змінні,
     * які дозволені вибраним шаблоном.
     */
    for (const variable of allowedVariables) {
        const item = returnedVariables.find(
            entry => entry?.name === variable
        );

        if (
            item &&
            item.value !== null &&
            item.value !== undefined &&
            String(item.value).trim() !== ''
        ) {
            variables[variable] =
                String(item.value).trim();
        } else {
            variables[variable] = null;
        }
    }

    return {
        template: selected || null,
        confidence,
        variables,
        responseId: response.id || null,
        model
    };
}

module.exports = {
    generateText,
    classifyTemplate,
    classifyTemplateWithVariables
};