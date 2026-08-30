const fs = require('fs');
const path = require('path');

const PRIVATE_TEMPLATES_PATH = path.join(
    __dirname,
    '..',
    'private',
    'templates.json'
);

const PUBLIC_TEMPLATES_PATH = path.join(
    __dirname,
    'templates.json'
);

function loadTemplates() {
    let filePath;

    if (fs.existsSync(PRIVATE_TEMPLATES_PATH)) {
        filePath = PRIVATE_TEMPLATES_PATH;
        console.log('LLM templates: використовую private/templates.json');
    } else {
        filePath = PUBLIC_TEMPLATES_PATH;
        console.log('LLM templates: private/templates.json не знайдено.');
        console.log('LLM templates: використовую llm/templates.json');
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    const templates = Array.isArray(data)
        ? data
        : data.templates;

    if (!Array.isArray(templates)) {
        throw new Error(
            `Файл шаблонів ${filePath} не містить масив templates.`
        );
    }

    return templates.map(template => ({
        ...template,

        // Приводимо обидва формати до єдиного.
        text: template.text ?? template.template ?? null,

        variables: Array.isArray(template.variables)
            ? template.variables
            : []
    }));
}

module.exports = {
    loadTemplates,
    PRIVATE_TEMPLATES_PATH,
    PUBLIC_TEMPLATES_PATH
};
