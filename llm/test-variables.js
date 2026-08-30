require('dotenv').config();

const {
    classifyTemplateWithVariables
} = require('./openai');

const { loadTemplates } = require('./templates');

const templates = loadTemplates();

const CONFIDENCE_THRESHOLD = 0.85;

const TESTS = [
    {
        name: '1. Реактивний БпЛА — destination',
        text: 'Реактивний БпЛА в бік Одеси',
        expectedTemplate: 'reactive_uav_direction',
        expectedVariables: {
            destination: 'Одеси'
        }
    },

    {
        name: '2. Група — пройшла місто + destination',
        text: 'Група реактивних БпЛА пройшла Миколаїв та рухається в бік Одеси',
        expectedTemplate: 'reactive_uav_passed_city',
        expectedVariables: {
            passed_location: 'Миколаїв',
            destination: 'Одеси'
        }
    },

    {
        name: '3. Група — вздовж маршруту',
        text: 'Група реактивних БпЛА вздовж Миколаєва рухається в бік Одеси',
        expectedTemplate: 'reactive_uav_along_route',
        expectedVariables: {
            from_location: 'Миколаєва',
            destination: 'Одеси'
        }
    },

    {
        name: '4. Тактична авіація — без змінних',
        text: 'Тактична авіація в акваторії Чорного моря',
        expectedTemplate: 'tactical_aviation_black_sea',
        expectedVariables: {}
    },

    {
        name: '5. Порт — кількість + напрямок + час',
        text: 'Крилаті ракети, в кількості 3, підтверджений напрямок морський порт Одеса, орієнтовний час підльоту 15 хвилин',
        expectedTemplate: 'port_threat_confirmed',
        expectedVariables: {
            threat_type: 'Крилаті ракети',
            quantity: '3',
            direction: 'Одеса',
            eta: '15 хвилин'
        }
    },

    {
        name: '6. Порт — попередня загроза',
        text: 'БпЛА, попередній напрямок морський порт Південний, орієнтовний час підльоту 20 хвилин',
        expectedTemplate: 'port_threat_preliminary',
        expectedVariables: {
            threat_type: 'БпЛА',
            direction: 'Південний',
            eta: '20 хвилин'
        }
    },

    {
        name: '7. Зміна курсу',
        text: 'БпЛА змінив курс з Миколаєва в бік Одеси',
        expectedTemplate: 'uav_course_change',
        expectedVariables: {
            from_location: 'Миколаєва',
            destination: 'Одеси'
        }
    },

    {
        name: '8. Відбій',
        text: 'Повітряна тривога завершена',
        expectedTemplate: 'air_alert_end',
        expectedVariables: {}
    },

    {
        name: '9. Невизначений напрямок',
        text: 'Група реактивних БпЛА вийшла в акваторію Чорного моря, напрямок поки невідомий',
        expectedTemplate: 'reactive_uav_direction_unknown',
        expectedVariables: {}
    },

    {
        name: '10. Відсутня інформація — не вигадувати',
        text: 'Група реактивних БпЛА рухається',
        expectedTemplate: null,
        expectedVariables: {},
        requireLowConfidence: true
    }
];

async function main() {
    console.log('=================================');
    console.log('AITube LLM VARIABLE TEST');
    console.log('=================================');
    console.log(`Шаблонів: ${templates.length}`);
    console.log(`Поріг confidence: ${CONFIDENCE_THRESHOLD}`);
    console.log('');

    let passed = 0;

    for (const test of TESTS) {
        console.log(`\n[TEST] ${test.name}`);
        console.log(`Вхід: ${test.text}`);

        try {
            const result = await classifyTemplateWithVariables({
                input: test.text,
                templates
            });

            console.log('Результат:');
            console.dir(result, { depth: null });

            /*
             * Спеціальний тест:
             *
             * Якщо інформації недостатньо,
             * нам не важливо, який шаблон LLM припустила.
             *
             * Важливо, щоб confidence був нижчим
             * за встановлений поріг.
             */
            if (test.requireLowConfidence) {
                if (result.confidence < CONFIDENCE_THRESHOLD) {
                    console.log(
                        `✅ LOW CONFIDENCE PASSED (${result.confidence} < ${CONFIDENCE_THRESHOLD})`
                    );
                    passed++;
                } else {
                    console.log(
                        `❌ LOW CONFIDENCE FAILED (${result.confidence} >= ${CONFIDENCE_THRESHOLD})`
                    );
                }

                continue;
            }

            const actualTemplate = result.template?.id || null;

            const templateOk =
                actualTemplate === test.expectedTemplate;

            if (!templateOk) {
                console.log(
                    `❌ Шаблон: очікувався "${test.expectedTemplate}", отримано "${actualTemplate}"`
                );
                continue;
            }

            /*
             * Перевірка confidence для нормальних
             * спеціалізованих шаблонів.
             */
            if (result.confidence < CONFIDENCE_THRESHOLD) {
                console.log(
                    `❌ CONFIDENCE TOO LOW: ${result.confidence} < ${CONFIDENCE_THRESHOLD}`
                );
                continue;
            }

            let variablesOk = true;

            for (const [key, expectedValue] of Object.entries(
                test.expectedVariables
            )) {
                const actualValue = result.variables?.[key];

                if (actualValue !== expectedValue) {
                    variablesOk = false;

                    console.log(
                        `❌ ${key}: очікувалось "${expectedValue}", отримано "${actualValue}"`
                    );
                }
            }

            /*
             * Додаткова перевірка:
             * LLM не повинна повертати зайві змінні.
             */
            const expectedKeys = Object.keys(
                test.expectedVariables
            );

            const actualKeys = Object.keys(
                result.variables || {}
            );

            const unexpectedKeys = actualKeys.filter(
                key => !expectedKeys.includes(key)
            );

            if (unexpectedKeys.length > 0) {
                variablesOk = false;

                console.log(
                    `❌ Зайві змінні: ${unexpectedKeys.join(', ')}`
                );
            }

            if (variablesOk) {
                console.log('✅ TEST PASSED');
                passed++;
            } else {
                console.log('❌ VARIABLES FAILED');
            }

        } catch (error) {
            console.log('❌ ERROR');
            console.error(error.message);
        }
    }

    console.log('');
    console.log('=================================');
    console.log(`Результат: ${passed}/${TESTS.length}`);
    console.log('=================================');

    if (passed !== TESTS.length) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});