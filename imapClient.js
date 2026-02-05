const { MailListener } = require('mail-listener6');
const eventBus = require('./eventBus');
const path = require("path");
const fs = require("fs");
const cheerio = require('cheerio'); // <- novo
const pastaAnexos = path.join(__dirname, 'anexos');
if (!fs.existsSync(pastaAnexos)) fs.mkdirSync(pastaAnexos);

let mailListener = null;

function pararMailListener() {
    if (mailListener) {
        mailListener.stop();
        mailListener = null;
        console.log('🛑 MailListener parado.');
    }
}

function reiniciarMailListener() {
    console.log('♻️ Recebido evento para reiniciar MailListener...');
    pararMailListener();
    setTimeout(() => {
        console.log("Iniciando o listener novamente...");
        const { executarRobo } = require('./index');
        executarRobo();
    }, 2000);
}

function iniciarListener(processarEmailCallback) {
    if (mailListener) {
        console.log('Listener já está ativo.');
        return;
    }

    mailListener = new MailListener({
        username: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        connTimeout: 25000,
        authTimeout: 20000,
        tlsOptions: { rejectUnauthorized: false },
        mailbox: 'INBOX',
        searchFilter: ['UNSEEN'],
        markSeen: true,
        fetchUnreadOnStart: true,
    });

    mailListener.start();

    mailListener.on('server:connected', () => console.log('✅ Conectado ao servidor de e-mail.'));
    mailListener.on('error', (err) => {
        console.error('❌ Erro no listener de e-mail:', err);
        reiniciarMailListener();
    });

    mailListener.on('mail', (mail) => {
        if (mail.subject.trim() !== 'Registro de Ponto') {
            return;
        }

        console.log(`📬 assunto "${mail.subject}" corresponde. Processando...`);

        let coordenadas = 'Não encontradas';

        if (mail.html) {
            const $ = cheerio.load(mail.html);

            $('a').each((i, el) => {
                const texto = $(el).text().trim().toLowerCase();
                if (texto.includes('local da inclusão de ponto')) {
                    const href = $(el).attr('href');
                    const match = href.match(/query=([-0-9.,]+)/);
                    if (match && match[1]) {
                        coordenadas = match[1];
                        console.log(`📍 Coordenadas extraídas: ${coordenadas}`);
                    } else {
                        coordenadas = 'URL sem coordenadas';
                    }
                }
            });
        }

        const caminhosDeImagem = [];
        if (mail.attachments && mail.attachments.length > 0) {
            for (const anexo of mail.attachments) {
                if (anexo.contentType.startsWith('image/')) {
                    const nomeArquivo = Date.now() + '-' + anexo.filename;
                    const caminho = path.join(pastaAnexos, nomeArquivo);
                    fs.writeFileSync(caminho, anexo.content);
                    caminhosDeImagem.push(caminho);
                }
            }
        }

        if (caminhosDeImagem.length > 0) {
            processarEmailCallback({ caminhosDeImagem, coordenadas });
        }
    });
}

eventBus.on('reiniciar-listener', reiniciarMailListener);

module.exports = { iniciarListener, pararMailListener };
