const fs = require('fs');
const path = require('path');

const {
    PROCESSING_MODES,
    processMessage
} = require('./processor');


async function main() {
    const templatesPath = path.join(
        __dirname,
        'templates.json'
    );

    const templates = JSON.parse(
        fs.readFileSync(
            templatesPath,
            'utf8'
        )
    );

    const testMessage =
        'Увага! В Одеській області оголошено повітряну тривогу.';


    console.log('=================================');
    console.log('AITube LLM module test');
    console.log('=================================');

    console.log('\nВхідне повідомлення:');
    console.log(testMessage);


    // ---------------------------------------------
    // Тест 1 — звичайне пересилання
    // ---------------------------------------------

    const forwardResult =
        await processMessage({
            text: testMessage,

            processing: {
                mode:
                    PROCESSING_MODES.FORWARD
            }
        });

    console.log('\n[1] FORWARD');
    console.log(forwardResult);


    // ---------------------------------------------
    // Тест 2 — готовий шаблон
    // ---------------------------------------------

    const templateResult =
        await processMessage({
            text: testMessage,

            processing: {
                mode:
                    PROCESSING_MODES.TEMPLATE,

                template:
                    templates[0].text
            }
        });

    console.log('\n[2] TEMPLATE');
    console.log(templateResult);


    // ---------------------------------------------
    // Тест 3 — перевірка LLM
    // ---------------------------------------------

    if (!process.env.OPENAI_API_KEY) {

        console.log(
            '\n[3] LLM'
        );

        console.log(
            'OPENAI_API_KEY не задано.'
        );

        console.log(
            'Тест LLM пропущено.'
        );

        return;
    }


    const llmResult =
        await processMessage({

            text:
                testMessage,

            processing: {

                mode:
                    PROCESSING_MODES.LLM_GENERATE,

                instructions:
                    [
                        'Ти редактор службових повідомлень.',
                        'Створи коротке, чітке та унікальне повідомлення',
                        'на основі вхідного тексту.',
                        'Не вигадуй нових фактів.',
                        'Зберігай основний зміст.',
                        'Відповідай українською мовою.',
                        'Поверни тільки готове повідомлення.'
                    ].join(' ')
            }
        });


    console.log('\n[3] LLM GENERATE');

    console.log(
        llmResult
    );
}


main()
    .catch(error => {

        console.error(
            '\n❌ TEST FAILED'
        );

        console.error(
            error.message
        );

        process.exit(1);
    });