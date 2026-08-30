require('dotenv').config();

const {
    processMessage
} = require('./processor');

const TESTS = [
    {
        name: '1. Реактивний БпЛА — напрямок',
        text: 'Реактивний БпЛА в бік Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'reactive_uav_direction',
            text: 'Реактивний БпЛА в бік міста Одеси'
        }
    },

    {
        name: '2. Реактивний БпЛА — невідомий напрямок',
        text: 'Група реактивних БпЛА вийшла в акваторію Чорного моря, напрямок поки невідомий',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'reactive_uav_direction_unknown',
            text: 'Вихід групи реактивних БпЛА в АЧМ, напрямок поки не відомий'
        }
    },

    {
        name: '3. Група — пройшла Миколаїв → Одеса',
        text: 'Група реактивних БпЛА пройшла Миколаїв та рухається в бік Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'reactive_uav_passed_city',
            text: 'Група реактивних БпЛА пройшла місто Миколаїв рухається в бік Одеси'
        }
    },

    {
        name: '4. Група — вздовж Миколаєва → Одеса',
        text: 'Група реактивних БпЛА вздовж Миколаєва рухається в бік Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'reactive_uav_along_route',
            text: 'Група реактивних БпЛА вздовж міста Миколаєва в бік Одеси'
        }
    },

    {
        name: '5. Маневрує в Чорному морі',
        text: 'Група реактивних БпЛА маневрує в акваторії Чорного моря',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'reactive_uav_maneuver_black_sea'
        }
    },

    {
        name: '6. Балістика — Крим → Одеса',
        text: 'Балістика з АР Крим в бік міста Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'ballistic_direction'
        }
    },

    {
        name: '7. Онікс — Крим → Одеса',
        text: 'Протикорабельна крилата ракета «Онікс» з АР Крим в бік міста Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'onyx_direction'
        }
    },

    {
        name: '8. Тактична авіація — Чорне море',
        text: 'Тактична авіація в акваторії Чорного моря',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'tactical_aviation_black_sea',
            text: 'Тактична авіація в акваторії Чорного моря'
        }
    },

    {
        name: '9. Тактична авіація — рубежі пусків',
        text: 'Вихід тактичної авіація на рубежі пусків крилатих ракет',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'tactical_aviation_launch_line'
        }
    },

    {
        name: '10. Тактична авіація — покинула акваторію',
        text: 'Тактична авіація покинула акваторію Чорного моря',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'tactical_aviation_left_black_sea'
        }
    },

    {
        name: '11. Бандероль — Одеса',
        text: 'БпЛА «Бандероль» в місто Одеса',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'banderole_direction'
        }
    },

    {
        name: '12. Бандероль — н.п. Одеса',
        text: 'БпЛА «Бандероль» в напрямку н.п. Одеса',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'banderole_direction_locality'
        }
    },

    {
        name: '13. Пуски крилатих ракет — Одеса',
        text: 'Пуски крилатих ракет в напрямок Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'cruise_missile_launch_direction'
        }
    },

    {
        name: '14. Можливі пуски — Одеса',
        text: 'Можливі пуски крилатих ракет в бік Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'possible_cruise_launch'
        }
    },

    {
        name: '15. Зміна курсу БпЛА — Миколаїв → Одеса',
        text: 'Зміна курсу БпЛА з міста Миколаєва в бік Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'uav_course_change'
        }
    },

    {
        name: '16. Зміна напрямку групи → Одеса',
        text: 'Зміна напрямку руху групи реактивних БпЛА в бік Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'reactive_uav_group_course_change'
        }
    },

    {
        name: '17. Зміна курсу балістики → Одеса',
        text: 'Зміна курсу балістики в бік міста Одеси',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'ballistic_course_change'
        }
    },

    {
        name: '18. Відбій',
        text: 'Відбій повітряної тривоги',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'air_alert_end',
            text: 'Відбій повітряної тривоги'
        }
    },

    {
        name: '19. Локаційно чисто',
        text: 'Локаційно поки що чисто',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'location_clear'
        }
    },

    {
        name: '20. БпЛА вражені + відбій',
        text: 'БпЛА вражені, відбій повітряної тривоги',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'uav_hit_air_alert_end'
        }
    },

    {
        name: '21. Цілі не спостерігаються + відбій',
        text: 'Повітряні цілі не спостерігаються, відбій',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'no_air_targets_air_alert_end'
        }
    },

    {
        name: '22. Чорне море — чисто',
        text: 'В акваторії Чорного моря наразі майже чисто',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'black_sea_clear'
        }
    },

    {
        name: '23. ПОРТ — Південний + 20 хв',
        text: 'БпЛА, попередній напрямок морський порт Південний, орієнтовний час підльоту 20 хвилин',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'port_threat_preliminary',
            text: 'БпЛА, попередній напрямок морський порт Південний, орієнтовний час підльоту 20 хвилин'
        }
    },

    {
        name: '24. ПОРТ — Одеса + 3 ракети + 15 хв',
        text: 'Крилаті ракети, в кількості 3, підтверджений напрямок морський порт Одеса, орієнтовний час підльоту 15 хвилин',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'port_threat_confirmed',
            text: 'Крилаті ракети, в кількості 3, підтверджений напрямок морський порт Одеса, орієнтовний час підльоту 15 хвилин'
        }
    },

    {
        name: '25. ПОРТ — зміна курсу → Одеса',
        text: 'Зміна курсу цілі, новий напрямок морський порт Одеса',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'port_course_or_target_change'
        }
    },

    {
        name: '26. ПОРТ — відбій → Одеса',
        text: 'Загроза для морського порту Одеса відсутня, повітряна загроза завершена',
        expected: {
            action: 'send',
            mode: 'llm_template',
            templateId: 'port_air_threat_end'
        }
    },

    {
        name: '27. Недостатньо інформації — fallback',
        text: 'Група реактивних БпЛА рухається',
        expected: {
            action: 'send',
            mode: 'llm_template',
            fallbackMode: 'llm_generate'
        }
    }
];


function checkResult(result, expected) {

    if (result.action !== expected.action) {
        return `action: очікувалось "${expected.action}", отримано "${result.action}"`;
    }

    if (result.mode !== expected.mode) {
        return `mode: очікувалось "${expected.mode}", отримано "${result.mode}"`;
    }

    if (
        expected.templateId &&
        result.templateId !== expected.templateId
    ) {
        return `templateId: очікувалось "${expected.templateId}", отримано "${result.templateId}"`;
    }

    if (
        expected.fallbackMode &&
        result.fallbackMode !== expected.fallbackMode
    ) {
        return `fallbackMode: очікувалось "${expected.fallbackMode}", отримано "${result.fallbackMode}"`;
    }

    /*
     * Якщо в тесті вказаний очікуваний
     * фінальний текст — порівнюємо його.
     */
    if (
        expected.text !== undefined &&
        result.text !== expected.text
    ) {
        return [
            'text не збігається:',
            `очікувалось: "${expected.text}"`,
            `отримано:    "${result.text}"`
        ].join('\n');
    }

    return null;
}


async function main() {

    console.log('=================================');
    console.log('AITube PROCESSOR — FINAL TEXT TEST');
    console.log('=================================');
    console.log(`Тестів: ${TESTS.length}`);
    console.log('');

    let passed = 0;

    for (const test of TESTS) {

        console.log(`[TEST] ${test.name}`);
        console.log(`Вхід: ${test.text}`);

        try {

            const result = await processMessage(test.text);

            console.log('Результат:');
            console.dir(result, { depth: null });

            const error = checkResult(
                result,
                test.expected
            );

            if (error) {

                console.log(`❌ FAILED: ${error}`);

            } else {

                console.log('✅ PASSED');
                passed++;

            }

        } catch (error) {

            console.log('❌ ERROR');
            console.error(error.message);

        }

        console.log('');
    }

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