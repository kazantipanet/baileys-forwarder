require('dotenv').config();

const {
    processMessage
} = require('./processor');

const {
    loadTemplates
} = require('./templates');

const templates = loadTemplates();

const CONFIDENCE_THRESHOLD = 0.85;

const TESTS = [
    {
        name: '1. Реактивний БпЛА — destination',
        text: 'Реактивний БпЛА в бік Одеси',
        expectedText:
            'Реактивний БпЛА в бік міста Одеси',
        expectedTemplate:
            'reactive_uav_direction'
    },

    {
        name: '2. Група — пройшла місто + destination',
        text:
            'Група реактивних БпЛА пройшла Миколаїв та рухається в бік Одеси',
        expectedText:
            'Група реактивних БпЛА пройшла місто Миколаїв рухається в бік Одеси',
        expectedTemplate:
            'reactive_uav_passed_city'
    },

    {
        name: '3. Група — вздовж маршруту',
        text:
            'Група реактивних БпЛА вздовж Миколаєва рухається в бік Одеси',
        expectedText:
            'Група реактивних БпЛА вздовж міста Миколаєва в бік Одеси',
        expectedTemplate:
            'reactive_uav_along_route'
    },

    {
        name: '4. Тактична авіація',
        text:
            'Тактична авіація в акваторії Чорного моря',
        expectedText:
            'Тактична авіація в акваторії Чорного моря',
        expectedTemplate:
            'tactical_aviation_black_sea'
    },

    {
        name: '5. Порт — кількість + напрямок + час',
        text:
            'Крилаті ракети, в кількості 3, підтверджений напрямок морський порт Одеса, орієнтовний час підльоту 15 хвилин',
        expectedText:
            'Крилаті ракети, в кількості 3, підтверджений напрямок морський порт Одеса, орієнтовний час підльоту 15 хвилин',
        expectedTemplate:
            'port_threat_confirmed'
    },

    {
        name: '6. Порт — попередня загроза',
        text:
            'БпЛА, попередній напрямок морський порт Південний, орієнтовний час підльоту 20 хвилин',
        expectedText:
            'БпЛА, попередній напрямок морський порт Південний, орієнтовний час підльоту 20 хвилин',
        expectedTemplate:
            'port_threat_preliminary'
    },

    {
        name: '7. Зміна курсу',
        text:
            'БпЛА змінив курс з Миколаєва в бік Одеси',
        expectedText:
            'Зміна курсу БпЛА з міста Миколаєва в бік Одеси',
        expectedTemplate:
            'uav_course_change'
    },

    {
        name: '8. Відбій',
        text:
            'Повітряна тривога завершена',
        expectedText:
            'Відбій повітряної тривоги',
        expectedTemplate:
            'air_alert_end'
    },

    {
        name: '9. Невизначений напрямок',
        text:
            'Група реактивних БпЛА вийшла в акваторію Чорного моря, напрямок поки невідомий',
        expectedText:
            'Вихід групи реактивних БпЛА в АЧМ, напрямок поки не відомий',
        expectedTemplate:
            'reactive_uav_direction_unknown'
    },

    {
        name: '10. Немає достатньої інформації',
        text:
            'Група реактивних БпЛА рухається',
        expectedSkip: true
    },

    {
        name: '11. Нерелевантне повідомлення',
        text:
            'Привіт, як справи?',
        expectedSkip: true
    },

    {
        name: '12. Побутове повідомлення',
        text:
            'Я буду через 10 хвилин',
        expectedSkip: true
    }
];

async function main() {

    console.log('=================================');
    console.log('AITube V2 — TEMPLATE ONLY TEST');
    console.log('=================================');
    console.log(`Шаблонів: ${templates.length}`);
    console.log(`Поріг confidence: ${CONFIDENCE_THRESHOLD}`);
    console.log('');

    let passed = 0;

    for (const test of TESTS) {

        console.log('');
        console.log(`[TEST] ${test.name}`);
        console.log(`Вхід: ${test.text}`);

        try {

            const result =
                await processMessage(
                    test.text,
                    {
                        confidenceThreshold:
                            CONFIDENCE_THRESHOLD
                    }
                );

            console.log('Результат:');
            console.dir(
                result,
                {
                    depth: null
                }
            );

            /*
             * ==========================================
             * SKIP TEST
             * ==========================================
             */

            if (test.expectedSkip) {

                if (
                    result.action === 'skip'
                ) {

                    console.log(
                        '✅ SKIP PASSED'
                    );

                    passed++;

                } else {

                    console.log(
                        '❌ SKIP FAILED'
                    );

                    console.log(
                        `Очікувалось action="skip", отримано "${result.action}"`
                    );
                }

                continue;
            }

            /*
             * ==========================================
             * ACTION
             * ==========================================
             */

            if (
                result.action !== 'send'
            ) {

                console.log(
                    `❌ ACTION: очікувався "send", отримано "${result.action}"`
                );

                continue;
            }

            /*
             * ==========================================
             * MODE
             * ==========================================
             */

            if (
                result.mode !==
                'llm_template'
            ) {

                console.log(
                    `❌ MODE: очікувався "llm_template", отримано "${result.mode}"`
                );

                continue;
            }

            /*
             * ==========================================
             * TEMPLATE
             * ==========================================
             */

            if (
                result.templateId !==
                test.expectedTemplate
            ) {

                console.log(
                    `❌ TEMPLATE: очікувався "${test.expectedTemplate}", отримано "${result.templateId}"`
                );

                continue;
            }

            /*
             * ==========================================
             * CONFIDENCE
             * ==========================================
             */

            if (
                result.confidence <
                CONFIDENCE_THRESHOLD
            ) {

                console.log(
                    `❌ CONFIDENCE: ${result.confidence} < ${CONFIDENCE_THRESHOLD}`
                );

                continue;
            }

            /*
             * ==========================================
             * TEXT
             * ==========================================
             */

            if (
                result.text !==
                test.expectedText
            ) {

                console.log(
                    '❌ TEXT НЕ СПІВПАВ'
                );

                console.log(
                    `Очікувалось:\n${test.expectedText}`
                );

                console.log(
                    `Отримано:\n${result.text}`
                );

                continue;
            }

            /*
             * ==========================================
             * VARIABLES
             * ==========================================
             */

            if (
                result.text.includes('{{') ||
                result.text.includes('}}')
            ) {

                console.log(
                    '❌ У тексті залишились {{змінні}}'
                );

                continue;
            }

            console.log(
                '✅ PASSED'
            );

            passed++;

        } catch (error) {

            console.log(
                '❌ ERROR'
            );

            console.log(
                error.message
            );
        }
    }

    console.log('');
    console.log('=================================');
    console.log(
        `Результат: ${passed}/${TESTS.length}`
    );
    console.log('=================================');

    if (
        passed !== TESTS.length
    ) {

        process.exitCode = 1;
    }
}

main();
