require('dotenv').config();

const {
    checkRelevance
} = require('./relevance-filter');


const tests = [

    // ==========================================
    // ПОВИННІ ПРОЙТИ
    // ==========================================

    {
        name: 'БпЛА → Одеса',
        input: 'БпЛА в бік Одеси',
        expected: true
    },

    {
        name: 'Шахеди → Одеса',
        input: '4 шахеди в бік Одеси',
        expected: true
    },

    {
        name: 'Реактивні БпЛА',
        input: 'Група реактивних БпЛА рухається',
        expected: true
    },

    {
        name: 'Крилаті ракети',
        input: 'Пуски крилатих ракет в напрямку Одеси',
        expected: true
    },

    {
        name: 'Балістика',
        input: 'Балістика в бік Одеси',
        expected: true
    },

    {
        name: 'Онікс',
        input: 'Можливі пуски Оніксів',
        expected: true
    },

    {
        name: 'Авіація',
        input: 'Тактична авіація в акваторії Чорного моря',
        expected: true
    },

    {
        name: 'Відбій',
        input: 'Відбій повітряної тривоги',
        expected: true
    },

    {
        name: 'Зміна курсу',
        input: 'Зміна курсу БпЛА в бік Одеси',
        expected: true
    },

    {
        name: 'Порт',
        input: 'БпЛА, напрямок морський порт Одеса',
        expected: true
    },


    // ==========================================
    // ПОВИННІ БУТИ SKIP
    // ==========================================

    {
        name: 'Звичайне привітання',
        input: 'Привіт',
        expected: false
    },

    {
        name: 'Побутове питання',
        input: 'Як справи?',
        expected: false
    },

    {
        name: 'Звичайний текст',
        input: 'Я буду через 10 хвилин',
        expected: false
    },

    {
        name: 'Звичайна розмова',
        input: 'Добре, домовились',
        expected: false
    },

    {
        name: 'Порожній текст',
        input: '',
        expected: false
    },

    {
        name: 'Пробіли',
        input: '     ',
        expected: false
    },


    // ==========================================
    // НЕ ТЕКСТ
    // ==========================================

    {
        name: 'Фото',
        input: {
            text: '',
            messageType: 'imageMessage'
        },
        expected: false
    },

    {
        name: 'Голосове',
        input: {
            text: '',
            messageType: 'audioMessage'
        },
        expected: false
    },

    {
        name: 'Стікер',
        input: {
            text: '',
            messageType: 'stickerMessage'
        },
        expected: false
    },

    {
        name: 'Відео без тексту',
        input: {
            text: '',
            messageType: 'videoMessage'
        },
        expected: false
    }

];


console.log(
    '================================='
);

console.log(
    'AITube V2 — RELEVANCE FILTER TEST'
);

console.log(
    '================================='
);

console.log(
    `Тестів: ${tests.length}`
);

console.log('');


let passed = 0;


for (
    let i = 0;
    i < tests.length;
    i++
) {

    const test =
        tests[i];


    const result =
        checkRelevance(
            test.input
        );


    const success =
        result.relevant ===
        test.expected;


    console.log(
        `[TEST] ${i + 1}. ${test.name}`
    );


    console.log(
        'Вхід:',
        test.input
    );


    console.log(
        'Результат:',
        result
    );


    if (success) {

        passed++;

        console.log(
            '✅ PASSED'
        );

    } else {

        console.log(
            '❌ FAILED'
        );

    }


    console.log('');
}


console.log(
    '================================='
);

console.log(
    `Результат: ${passed}/${tests.length}`
);

console.log(
    '================================='
);


if (
    passed !== tests.length
) {

    process.exit(1);
}