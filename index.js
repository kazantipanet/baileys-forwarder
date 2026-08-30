const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const P = require('pino');

const express = require('express');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
    processMessage
} = require('./llm/processor');

// ==================================================
// НАЛАШТУВАННЯ СИСТЕМИ
// ==================================================

const CONFIG_FILE =
    path.join(
        __dirname,
        'config.json'
    );

const PROCESSED_FILE =
    path.join(
        __dirname,
        'processed_messages.json'
    );

const AUTH_DIR =
    path.join(
        __dirname,
        'auth_info'
    );


// ==================================================
// ФАЙЛ ЖУРНАЛУ ПЕРЕСИЛАНЬ
// ==================================================

const FORWARDING_LOG_FILE =
    path.join(
        __dirname,
        'forwarding_log.json'
    );


// Максимальна кількість записів у журналі
const MAX_LOG_RECORDS = 1000;


// Максимальна кількість ключів оброблених повідомлень
const MAX_PROCESSED_MESSAGES = 10000;


// ==================================================
// ЗАВАНТАЖЕННЯ КОНФІГУРАЦІЇ
// ==================================================

function loadConfig() {

    try {

        if (
            !fs.existsSync(
                CONFIG_FILE
            )
        ) {

            const defaultConfig = {

                server: {

                    host:
                        '127.0.0.1',

                    port:
                        3000
                },


                forwarding_rules: []

            };


            fs.writeFileSync(
                CONFIG_FILE,
                JSON.stringify(
                    defaultConfig,
                    null,
                    4
                )
            );


            return defaultConfig;
        }


        return JSON.parse(
            fs.readFileSync(
                CONFIG_FILE,
                'utf8'
            )
        );

    } catch (error) {

        console.error(
            '❌ Не вдалося завантажити конфігурацію:',
            error
        );


        process.exit(1);
    }
}


const config =
    loadConfig();


// ==================================================
// СТАН СИСТЕМИ
// ==================================================

let whatsappSocket = null;

let whatsappConnected = false;

let groups = [];


// Захист від паралельних запусків
// під час перепідключення
let reconnectTimer = null;

let whatsappStarting = false;


// ==================================================
// ЖУРНАЛ ОБРОБЛЕНИХ ПОВІДОМЛЕНЬ
// ==================================================

function loadProcessedMessages() {

    try {

        if (
            !fs.existsSync(
                PROCESSED_FILE
            )
        ) {

            return new Set();
        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    PROCESSED_FILE,
                    'utf8'
                )
            );


        return new Set(
            data
        );

    } catch (error) {

        console.error(
            '⚠️ Не вдалося завантажити журнал повідомлень:',
            error
        );


        return new Set();
    }
}


function saveProcessedMessages(
    processedMessages
) {

    try {

        // Зберігаємо тільки останні ключі
        const values =
            Array.from(
                processedMessages
            ).slice(
                -MAX_PROCESSED_MESSAGES
            );


        // Оновлюємо Set у пам'яті
        processedMessages.clear();


        values.forEach(
            value =>
                processedMessages.add(
                    value
                )
        );


        fs.writeFileSync(
            PROCESSED_FILE,
            JSON.stringify(
                values,
                null,
                4
            )
        );

    } catch (error) {

        console.error(
            '⚠️ Не вдалося зберегти журнал повідомлень:',
            error
        );
    }
}


const processedMessages =
    loadProcessedMessages();


// ==================================================
// ЖУРНАЛ ПЕРЕСИЛАНЬ
// ==================================================

function loadForwardingLog() {

    try {

        if (
            !fs.existsSync(
                FORWARDING_LOG_FILE
            )
        ) {

            return [];
        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    FORWARDING_LOG_FILE,
                    'utf8'
                )
            );


        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            '⚠️ Не вдалося завантажити журнал пересилань:',
            error
        );


        return [];
    }
}


function saveForwardingLog() {

    try {

        // Зберігаємо тільки останні записи
        forwardingLog =
            forwardingLog.slice(
                -MAX_LOG_RECORDS
            );


        fs.writeFileSync(
            FORWARDING_LOG_FILE,
            JSON.stringify(
                forwardingLog,
                null,
                4
            )
        );

    } catch (error) {

        console.error(
            '⚠️ Не вдалося зберегти журнал пересилань:',
            error
        );
    }
}


let forwardingLog =
    loadForwardingLog();


// ==================================================
// РОБОТА З ДАТОЮ ТА ЧАСОМ
// ==================================================

function getKyivDateString(
    date = new Date()
) {

    const parts =
        new Intl.DateTimeFormat(
            'en-CA',
            {
                timeZone:
                    'Europe/Kyiv',

                year:
                    'numeric',

                month:
                    '2-digit',

                day:
                    '2-digit'
            }
        ).formatToParts(
            date
        );


    const values = {};


    parts.forEach(
        part => {

            if (
                part.type !==
                'literal'
            ) {

                values[
                    part.type
                ] =
                    part.value;
            }
        }
    );


    return (
        `${values.year}-${values.month}-${values.day}`
    );
}


// ==================================================
// ЗБЕРЕЖЕННЯ КОНФІГУРАЦІЇ
// ==================================================

function saveConfig() {

    fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(
            config,
            null,
            4
        )
    );
}


// ==================================================
// ОТРИМАННЯ ГРУП WHATSAPP
// ==================================================

async function updateGroups() {

    if (
        !whatsappSocket ||
        !whatsappConnected
    ) {

        return [];
    }


    try {

        const result =
            await whatsappSocket
                .groupFetchAllParticipating();


        groups =
            Object.values(
                result
            )
                .map(
                    group => ({

                        id:
                            group.id,

                        name:
                            group.subject ||
                            'Без назви',

                        participants:
                            group.participants
                                ?.length ||
                            0

                    })
                )
                .sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name
                        )
                );


        return groups;

    } catch (error) {

        console.error(
            '❌ Не вдалося отримати список груп:',
            error
        );


        return groups;
    }
}


// ==================================================
// ПОШУК ГРУПИ
// ==================================================

function findGroup(
    groupId
) {

    return groups.find(
        group =>
            group.id ===
            groupId
    );
}


// ==================================================
// ОТРИМАННЯ ТЕКСТУ ПОВІДОМЛЕННЯ
// ==================================================

function getMessageText(
    message
) {

    const msg =
        message.message;


    // Звичайний текст
    if (
        msg?.conversation
    ) {

        return msg.conversation;
    }


    // Розширений текст
    if (
        msg?.extendedTextMessage?.text
    ) {

        return (
            msg.extendedTextMessage.text
        );
    }


    // Фото
    if (
        msg?.imageMessage
    ) {

        return (
            msg.imageMessage.caption
                ? `[Фото] ${msg.imageMessage.caption}`
                : '[Фото]'
        );
    }


    // Відео
    if (
        msg?.videoMessage
    ) {

        return (
            msg.videoMessage.caption
                ? `[Відео] ${msg.videoMessage.caption}`
                : '[Відео]'
        );
    }


    // Документ
    if (
        msg?.documentMessage
    ) {

        return (
            msg.documentMessage.caption
                ? `[Документ] ${msg.documentMessage.caption}`
                : '[Документ]'
        );
    }


    // Голосове повідомлення
    if (
        msg?.audioMessage
    ) {

        return '[Голосове повідомлення]';
    }


    // Стікер
    if (
        msg?.stickerMessage
    ) {

        return '[Стікер]';
    }


    return '[Повідомлення без тексту]';
}


// ==================================================
// ПЕРЕСИЛАННЯ ПОВІДОМЛЕННЯ
// ==================================================

async function forwardMessage(
    message,
    rule
) {

    const messageId =
        message.key?.id;


    if (!messageId) {

        return;
    }


    // Унікальний ключ повідомлення
    const processKey =
        `${rule.source}|${rule.target}|${messageId}`;


    // Перевіряємо, чи повідомлення вже пересилалося
    if (
        processedMessages.has(
            processKey
        )
    ) {

        console.log(
            '⏭️ Повідомлення вже пересилалося:',
            processKey
        );


        return;
    }


    // Визначаємо відправника
    const senderId =
        message.key?.participantAlt ||
        message.key?.participant ||
        'Невідомий відправник';


    const senderName =
        message.pushName ||
        senderId;


    // Тип повідомлення
    const messageType =
        Object.keys(
            message.message || {}
        ).find(
            type =>
                type !==
                'messageContextInfo'
        ) ||
        'невідомий';


    // Отримуємо текст
    const text =
        getMessageText(
            message
        );


    // ==================================================
    // V2: ОБРОБЛЯЄМО ТІЛЬКИ ТЕКСТОВІ ПОВІДОМЛЕННЯ
    // ==================================================

    if (
        messageType !== 'conversation' &&
        messageType !== 'extendedTextMessage'
    ) {

        console.log(
            '⏭️ SKIP — нетекстове повідомлення:',
            messageType
        );

        return;
    }

    // Отримуємо назви груп
    const sourceGroup =
        findGroup(
            rule.source
        );


    const targetGroup =
        findGroup(
            rule.target
        );


    try {

        // ------------------------------------------
        // LLM ОБРОБКА ТА ФОРМУВАННЯ ПОВІДОМЛЕННЯ
        // ------------------------------------------

        console.log(
            '\n🤖 Передаю повідомлення до LLM...'
        );

        console.log(
            'Вхідний текст:',
            text
        );

        const processed =
            await processMessage(
                text
            );

        console.log(
            'LLM результат:'
        );

        console.dir(
            processed,
            {
                depth: null
            }
        );

        // Якщо processor вирішив не відправляти
        if (
            processed.action !== 'send'
        ) {

            console.log(
                '⏭️ LLM не рекомендує відправляти повідомлення.'
            );

            return;
        }

        // Готовий текст для WhatsApp
        const outputText =
            processed.text;

        if (
            !outputText ||
            !String(outputText).trim()
        ) {

            throw new Error(
                'LLM Processor повернув порожній текст.'
            );
        }

        console.log(
            '📤 Фінальний текст:',
            outputText
        );

        // ------------------------------------------
        // ВІДПРАВЛЕННЯ СФОРМОВАНОГО ТЕКСТУ
        // ------------------------------------------

        await whatsappSocket.sendMessage(
            rule.target,
            {
                text:
                    outputText
            }
        );

        // ------------------------------------------
        // ФІКСУЄМО УСПІШНЕ ПЕРЕСИЛАННЯ
        // ------------------------------------------

        processedMessages.add(
            processKey
        );


        saveProcessedMessages(
            processedMessages
        );


        // Додаємо запис до журналу

        forwardingLog.push({

            id:
                crypto.randomUUID(),

            date:
                new Date().toISOString(),

            status:
                'success',

            source:
                rule.source,

            sourceName:
                sourceGroup?.name ||
                rule.source,

            target:
                rule.target,

            targetName:
                targetGroup?.name ||
                rule.target,

            sender:
                senderName,

            senderId,

            messageType,

            text,

            messageId

        });


        saveForwardingLog();


        // ------------------------------------------
        // ВИВЕДЕННЯ В КОНСОЛЬ
        // ------------------------------------------

        console.log(
            '\n========================================'
        );


        console.log(
            '✅ ПОВІДОМЛЕННЯ ПЕРЕСЛАНО'
        );


        console.log(
            'Звідки:',
            sourceGroup?.name ||
            rule.source
        );


        console.log(
            'Куди:',
            targetGroup?.name ||
            rule.target
        );


        console.log(
            'Відправник:',
            senderName,
            `(${senderId})`
        );


        console.log(
            'Тип повідомлення:',
            messageType
        );


        console.log(
            'Текст:',
            text
        );


        console.log(
            'ID повідомлення:',
            messageId
        );


        console.log(
            '========================================\n'
        );


    } catch (error) {

        // ------------------------------------------
        // ФІКСУЄМО ПОМИЛКУ
        // ------------------------------------------

        forwardingLog.push({

            id:
                crypto.randomUUID(),

            date:
                new Date().toISOString(),

            status:
                'error',

            source:
                rule.source,

            sourceName:
                sourceGroup?.name ||
                rule.source,

            target:
                rule.target,

            targetName:
                targetGroup?.name ||
                rule.target,

            sender:
                senderName,

            senderId,

            messageType,

            text,

            messageId,

            error:
                error.message ||
                String(error)

        });


        saveForwardingLog();


        console.error(
            '❌ ПОМИЛКА ПЕРЕСИЛАННЯ:',
            error
        );
    }
}
// ==================================================
// ОБРОБКА ВХІДНИХ ПОВІДОМЛЕНЬ
// ==================================================

async function processIncomingMessages(
    messages,
    type
) {

    // Обробляємо тільки нові повідомлення
    if (
        type !== 'notify'
    ) {

        return;
    }


    for (
        const message
        of messages
    ) {

        try {

            // ------------------------------------------
            // ПЕРЕВІРКА ПОВІДОМЛЕННЯ
            // ------------------------------------------

            if (
                !message ||
                !message.message
            ) {

                continue;
            }


            const jid =
                message.key?.remoteJid;


            // Нас цікавлять тільки групи
            if (
                !jid ||
                !jid.endsWith(
                    '@g.us'
                )
            ) {

                continue;
            }


            // Не обробляємо власні повідомлення
            if (
                message.key?.fromMe
            ) {

                continue;
            }


            // Визначаємо тип повідомлення
            const messageType =
                Object.keys(
                    message.message
                ).find(
                    type =>
                        type !==
                        'messageContextInfo'
                );


            // Ігноруємо службові повідомлення
            if (
                messageType ===
                'protocolMessage'
            ) {

                continue;
            }


            if (
                messageType ===
                'senderKeyDistributionMessage'
            ) {

                continue;
            }


            // ------------------------------------------
            // ЗНАХОДИМО АКТИВНІ ПРАВИЛА
            // ------------------------------------------

            const rules =
                config.forwarding_rules
                    .filter(
                        rule =>
                            rule.enabled &&
                            rule.source ===
                            jid
                    );


            // Якщо для цієї групи немає
            // активних правил — нічого не робимо

            if (
                !rules.length
            ) {

                continue;
            }


            // ------------------------------------------
            // ІНФОРМАЦІЯ ПРО ПОВІДОМЛЕННЯ
            // ------------------------------------------

            const senderId =
                message.key?.participantAlt ||
                message.key?.participant ||
                'Невідомий відправник';


            const senderName =
                message.pushName ||
                senderId;


            const text =
                getMessageText(
                    message
                );


            console.log(
                '\n========================================'
            );


            console.log(
                '📩 НОВЕ ПОВІДОМЛЕННЯ'
            );


            console.log(
                '========================================'
            );


            console.log(
                'Група:',
                findGroup(jid)?.name ||
                jid
            );


            console.log(
                'Відправник:',
                senderName
            );


            console.log(
                'ID відправника:',
                senderId
            );


            console.log(
                'Тип:',
                messageType
            );


            console.log(
                'Текст:',
                text
            );


            console.log(
                'ID повідомлення:',
                message.key?.id
            );


            console.log(
                'Активних правил:',
                rules.length
            );


            console.log(
                '========================================\n'
            );


            // ------------------------------------------
            // ПЕРЕСИЛАЄМО ЗА ВСІМА АКТИВНИМИ ПРАВИЛАМИ
            // ------------------------------------------

            for (
                const rule
                of rules
            ) {

                await forwardMessage(
                    message,
                    rule
                );
            }

        } catch (error) {

            console.error(
                '❌ Помилка обробки повідомлення:',
                error
            );
        }
    }
}


// ==================================================
// ПІДКЛЮЧЕННЯ ДО WHATSAPP
// ==================================================

async function startWhatsApp() {

    // Не допускаємо одночасного
    // запуску декількох підключень

    if (
        whatsappStarting
    ) {

        return;
    }


    whatsappStarting =
        true;


    try {

        console.log(
            '🔄 Підключення до WhatsApp...'
        );


        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                AUTH_DIR
            );


        const socket =
            makeWASocket({

                auth:
                    state,

                browser:
                    Browsers.macOS(
                        'WhatsApp Forwarder'
                    ),

                printQRInTerminal:
                    false,

                markOnlineOnConnect:
                    false,

                logger:
                    P({
                        level:
                            'silent'
                    })

            });


        whatsappSocket =
            socket;


        // ------------------------------------------
        // ЗБЕРЕЖЕННЯ ДАНИХ АВТОРИЗАЦІЇ
        // ------------------------------------------

        socket.ev.on(
            'creds.update',
            saveCreds
        );


        // ------------------------------------------
        // СТАН ПІДКЛЮЧЕННЯ
        // ------------------------------------------

        socket.ev.on(
            'connection.update',
            async update => {

                const {
                    connection,
                    lastDisconnect,
                    qr
                } =
                    update;


                // QR-код
                if (
                    qr
                ) {

                    console.log(
                        '\n========================================'
                    );


                    console.log(
                        '📱 ВІДСКАНУЙ QR-КОД У WHATSAPP'
                    );


                    console.log(
                        '========================================\n'
                    );


                    qrcode.generate(
                        qr,
                        {
                            small:
                                true
                        }
                    );
                }


                // Підключення
                if (
                    connection ===
                    'connecting'
                ) {

                    console.log(
                        '🔄 Підключення до WhatsApp...'
                    );
                }


                // Успішне підключення
                if (
                    connection ===
                    'open'
                ) {

                    whatsappConnected =
                        true;


                    console.log(
                        '\n========================================'
                    );


                    console.log(
                        '✅ WHATSAPP ПІДКЛЮЧЕНО'
                    );


                    console.log(
                        '========================================\n'
                    );


                    await updateGroups();


                    console.log(
                        `📋 Доступно груп: ${groups.length}`
                    );


                    console.log(
                        `📋 Налаштовано правил: ${config.forwarding_rules.length
                        }`
                    );


                    console.log(
                        '\n🌐 Веб-інтерфейс:'
                    );


                    console.log(
                        'http://127.0.0.1:3000'
                    );


                    console.log('');
                }


                // З'єднання закрито
                if (
                    connection ===
                    'close'
                ) {

                    whatsappConnected =
                        false;


                    const statusCode =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;


                    console.log(
                        '⚠️ З\'єднання закрито. Код:',
                        statusCode
                    );


                    // Якщо користувач
                    // вийшов з авторизації
                    if (
                        statusCode ===
                        DisconnectReason.loggedOut
                    ) {

                        whatsappSocket =
                            null;


                        console.log(
                            '❌ WhatsApp вийшов з авторизації.'
                        );


                        console.log(
                            'Потрібна повторна авторизація через QR-код.'
                        );


                        return;
                    }


                    // --------------------------------------
                    // БЕЗПЕЧНЕ ПОВТОРНЕ ПІДКЛЮЧЕННЯ
                    // --------------------------------------

                    whatsappSocket =
                        null;


                    if (
                        !reconnectTimer
                    ) {

                        console.log(
                            '🔄 Повторне підключення через 3 секунди...'
                        );


                        reconnectTimer =
                            setTimeout(
                                async () => {

                                    reconnectTimer =
                                        null;


                                    try {

                                        await startWhatsApp();

                                    } catch (
                                    error
                                    ) {

                                        console.error(
                                            '❌ Помилка повторного підключення:',
                                            error
                                        );
                                    }

                                },
                                3000
                            );
                    }
                }

            }
        );


        // ------------------------------------------
        // ОТРИМАННЯ НОВИХ ПОВІДОМЛЕНЬ
        // ------------------------------------------

        socket.ev.on(
            'messages.upsert',
            async ({
                messages,
                type
            }) => {

                try {

                    await processIncomingMessages(
                        messages,
                        type
                    );

                } catch (
                error
                ) {

                    console.error(
                        '❌ Помилка обробки повідомлень:',
                        error
                    );
                }
            }
        );


        whatsappStarting =
            false;

    } catch (
    error
    ) {

        whatsappStarting =
            false;


        console.error(
            '❌ Не вдалося запустити WhatsApp:',
            error
        );


        throw error;
    }
}


// ==================================================
// ВЕБ-СЕРВЕР
// ==================================================

const app =
    express();


app.use(
    express.json()
);


app.use(
    express.static(
        path.join(
            __dirname,
            'public'
        )
    )
);


// ==================================================
// API: СТАН СИСТЕМИ
// ==================================================

app.get(
    '/api/status',
    async (
        req,
        res
    ) => {

        res.json({

            connected:
                whatsappConnected,

            groupsCount:
                groups.length,

            activeRules:
                config.forwarding_rules
                    .filter(
                        rule =>
                            rule.enabled
                    )
                    .length,

            totalRules:
                config.forwarding_rules.length

        });
    }
);


// ==================================================
// API: СПИСОК ГРУП
// ==================================================

app.get(
    '/api/groups',
    async (
        req,
        res
    ) => {

        if (
            whatsappConnected
        ) {

            await updateGroups();
        }


        res.json(
            groups
        );
    }
);


// ==================================================
// API: СПИСОК ПРАВИЛ
// ==================================================

app.get(
    '/api/rules',
    (
        req,
        res
    ) => {

        res.json(
            config.forwarding_rules
        );
    }
);


// ==================================================
// API: ДОДАВАННЯ ПРАВИЛА
// ==================================================

app.post(
    '/api/rules',
    (
        req,
        res
    ) => {

        const {
            source,
            target
        } =
            req.body;


        if (
            !source ||
            !target
        ) {

            return res
                .status(400)
                .json({
                    error:
                        'Необхідно вказати групу-джерело та групу-отримувач.'
                });
        }


        if (
            source ===
            target
        ) {

            return res
                .status(400)
                .json({
                    error:
                        'Група-джерело та група-отримувач не можуть бути однаковими.'
                });
        }


        // Перевірка дубліката
        const duplicate =
            config.forwarding_rules
                .some(
                    rule =>
                        rule.source ===
                        source &&
                        rule.target ===
                        target
                );


        if (
            duplicate
        ) {

            return res
                .status(400)
                .json({
                    error:
                        'Таке правило вже існує.'
                });
        }


        const rule = {

            id:
                crypto.randomUUID(),

            source,

            target,

            enabled:
                true,

            createdAt:
                new Date().toISOString()

        };


        config.forwarding_rules.push(
            rule
        );


        saveConfig();


        console.log(
            '➕ Додано нове правило:',
            rule
        );


        res.json(
            rule
        );
    }
);


// ==================================================
// API: РЕДАГУВАННЯ ПРАВИЛА
// ==================================================

app.put(
    '/api/rules/:id',
    (
        req,
        res
    ) => {

        const {
            source,
            target
        } =
            req.body;


        if (
            !source ||
            !target
        ) {

            return res
                .status(400)
                .json({
                    error:
                        'Необхідно вказати групу-джерело та групу-отримувач.'
                });
        }


        if (
            source ===
            target
        ) {

            return res
                .status(400)
                .json({
                    error:
                        'Група-джерело та група-отримувач не можуть бути однаковими.'
                });
        }


        const rule =
            config.forwarding_rules.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (
            !rule
        ) {

            return res
                .status(404)
                .json({
                    error:
                        'Правило не знайдено.'
                });
        }


        // Перевіряємо дублікати
        const duplicate =
            config.forwarding_rules
                .some(
                    item =>
                        item.id !==
                        req.params.id &&
                        item.source ===
                        source &&
                        item.target ===
                        target
                );


        if (
            duplicate
        ) {

            return res
                .status(400)
                .json({
                    error:
                        'Таке правило вже існує.'
                });
        }


        rule.source =
            source;


        rule.target =
            target;


        rule.updatedAt =
            new Date().toISOString();


        saveConfig();


        console.log(
            '✏️ Правило змінено:',
            rule.id
        );


        res.json(
            rule
        );
    }
);


// ==================================================
// API: УВІМКНЕННЯ / ПРИЗУПИНЕННЯ
// ==================================================

app.post(
    '/api/rules/:id/toggle',
    (
        req,
        res
    ) => {

        const rule =
            config.forwarding_rules.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (
            !rule
        ) {

            return res
                .status(404)
                .json({
                    error:
                        'Правило не знайдено.'
                });
        }


        rule.enabled =
            !rule.enabled;


        rule.updatedAt =
            new Date().toISOString();


        saveConfig();


        console.log(
            rule.enabled
                ? '▶️ Правило увімкнено:'
                : '⏸️ Правило призупинено:',
            rule.id
        );


        res.json(
            rule
        );
    }
);


// ==================================================
// API: ВИДАЛЕННЯ ПРАВИЛА
// ==================================================

app.delete(
    '/api/rules/:id',
    (
        req,
        res
    ) => {

        const index =
            config.forwarding_rules
                .findIndex(
                    item =>
                        item.id ===
                        req.params.id
                );


        if (
            index ===
            -1
        ) {

            return res
                .status(404)
                .json({
                    error:
                        'Правило не знайдено.'
                });
        }


        const removed =
            config.forwarding_rules
                .splice(
                    index,
                    1
                )[0];


        saveConfig();


        console.log(
            '🗑️ Правило видалено:',
            removed
        );


        res.json({
            success:
                true,

            removed
        });
    }
);


// ==================================================
// API: ЖУРНАЛ ПЕРЕСИЛАНЬ
// ==================================================

app.get(
    '/api/logs',
    (
        req,
        res
    ) => {

        const limit =
            Math.min(
                Number(
                    req.query.limit
                ) || 50,
                200
            );


        const logs =
            forwardingLog
                .slice(
                    -limit
                )
                .reverse();


        res.json(
            logs
        );
    }
);


// ==================================================
// API: СТАТИСТИКА
// ==================================================

app.get(
    '/api/statistics',
    (
        req,
        res
    ) => {

        const today =
            getKyivDateString();


        const todayLogs =
            forwardingLog.filter(
                item =>
                    item.date
                        ?.startsWith(
                            today
                        )
            );


        const successful =
            todayLogs.filter(
                item =>
                    item.status ===
                    'success'
            ).length;


        const errors =
            todayLogs.filter(
                item =>
                    item.status ===
                    'error'
            ).length;


        res.json({

            todayTotal:
                todayLogs.length,

            todaySuccessful:
                successful,

            todayErrors:
                errors,

            total:
                forwardingLog.length

        });
    }
);


// ==================================================
// ЗАПУСК ВЕБ-СЕРВЕРА
// ==================================================

const PORT =
    config.server?.port ||
    3000;


const HOST =
    config.server?.host ||
    '127.0.0.1';


app.listen(
    PORT,
    HOST,
    () => {

        console.log(
            '\n========================================'
        );


        console.log(
            '🌐 ВЕБ-ІНТЕРФЕЙС ЗАПУЩЕНО'
        );


        console.log(
            `http://${HOST}:${PORT}`
        );


        console.log(
            '========================================\n'
        );
    }
);


// ==================================================
// ЗАПУСК WHATSAPP
// ==================================================

startWhatsApp()
    .catch(
        error => {

            console.error(
                '❌ Критична помилка запуску:',
                error
            );
        }
    );