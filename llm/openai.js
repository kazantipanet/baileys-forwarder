require('dotenv').config();
const OpenAI = require('openai');

// Модель задається через OPENAI_MODEL.
// Не зберігаємо назву моделі жорстко в коді, щоб її можна було змінити без редагування модуля.
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);

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

async function generateText({
    input,
    instructions,
    model = DEFAULT_MODEL,
    apiKey
}) {
    if (!input || !String(input).trim()) {
        throw new Error('LLM отримав порожній текст повідомлення.');
    }

    const response = await getClient(apiKey).responses.create({
        model,
        instructions,
        input: String(input),
        store: false
    });

    const text = response.output_text?.trim();

    if (!text) {
        throw new Error('LLM не повернула текстовий результат.');
    }

    return {
        text,
        responseId: response.id || null,
        model
    };
}

async function classifyTemplate({
    input,
    templates,
    instructions,
    model = DEFAULT_MODEL,
    apiKey
}) {
    if (!input || !String(input).trim()) {
        throw new Error('LLM отримав порожній текст повідомлення.');
    }

    if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error('Не налаштовано жодного шаблону для LLM-класифікації.');
    }

    const templateList = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        text: template.text
    }));

    const response = await getClient(apiKey).responses.create({
        model,
        instructions: instructions || [
            'Ти класифікатор повідомлень.',
            'Визнач, який із наданих шаблонів найкраще відповідає змісту вхідного повідомлення.',
            'Не вигадуй нових template_id.',
            'Якщо жоден шаблон не відповідає змісту, поверни template_id = null.'
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
                    required: ['template_id', 'confidence'],
                    additionalProperties: false
                }
            }
        },
        store: false
    });

    const raw = response.output_text?.trim();

    if (!raw) {
        throw new Error('LLM не повернула результат класифікації.');
    }

    let result;

    try {
        result = JSON.parse(raw);
    } catch (error) {
        throw new Error(`LLM повернула некоректний JSON: ${error.message}`);
    }

    const selected = templates.find(
        template => template.id === result.template_id
    );

    if (!selected) {
        return {
            template: null,
            confidence: Number(result.confidence) || 0,
            responseId: response.id || null,
            model
        };
    }

    return {
        template: selected,
        confidence: Math.max(
            0,
            Math.min(1, Number(result.confidence) || 0)
        ),
        responseId: response.id || null,
        model
    };
}

module.exports = {
    generateText,
    classifyTemplate
};
