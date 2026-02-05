const wppconnect = require('@wppconnect-team/wppconnect');
const eventBus = require('./eventBus');

let clientInstance = null;

async function iniciarWPP() {
    if (clientInstance) return clientInstance;
    try {
        clientInstance = await wppconnect.create({
            session: 'robo-ponto',
            autoClose: false,
            catchQR: (base64Qr, asciiQR) => console.log(asciiQR),
            logQR: false
        });

        clientInstance.onMessage(async (message) => {
            if (message.body.toLowerCase().includes('pix')) {
                clientInstance.sendPixKey(message.from, {
                    keyType: 'CNPJ',
                    name: process.env.NOME_USUARIO, // 
                    key: process.env.PIX_KEY,      // 
                    instructions: 'Instruções',
                });
            }

            if (message.body === '!reiniciar') {
                eventBus.emit('reiniciar-listener');
                clientInstance.sendText(message.from, '♻️ Comando de reinicialização enviado.');
            }

            if (message.body === '!tempo') {
                console.log("Comando !tempo recebido. Emitindo evento...");
                // Apenas emite um evento com o número de quem pediu
                eventBus.emit('comando-tempo', { from: message.from });
            }

            if (message.body.toLowerCase().startsWith('!horasextras')) {
                const partes = message.body.split(' ');
                const mes = partes[1] || null;
                eventBus.emit('comando-horas-extras', { from: message.from, mes });
            }

            if (message.body === '!atestadocomp' || message.body === '!atestado' || message.body === '!fechar') {
                eventBus.emit('comando-fechamento', {
                    from: message.from,
                    comando: message.body
                });
            }

        });

        console.log('✅ Cliente WhatsApp conectado e ouvindo por comandos!');
        return clientInstance;
    } catch (error) {
        console.error("❌ Erro ao iniciar o cliente WhatsApp:", error);
        clientInstance = null;
    }
}

async function enviarTexto(para, mensagem) {
    try {
        if (!clientInstance) {
            console.log("Cliente WhatsApp não iniciado. Aguardando...");
            await iniciarWPP();
        }
        await clientInstance.sendText(para, mensagem);
        console.log(`✅ Mensagem de texto enviada para ${para}`);
    } catch (err) {
        console.error('❌ Erro ao enviar texto:', err);
    }
}

async function enviarMensagemWhatsApp(dados) {
    // Esta função para as batidas individuais continua igual.
    try {
        const client = await iniciarWPP();
        const numero = process.env.NUMERO_OFICIAL;
        const mensagem = `📋 *Registro de Ponto:*

🔢 NSR: ${dados.nsr}
🗓️ Data: ${dados.data}
⏰ Hora: ${dados.hora}
👤 Nome: ${dados.nome}
🏢 CNPJ: ${dados.cnpj}
📍 Coordenadas: ${dados.coordenadas}
📜 Registro INPI: ${dados.registroInpi}`;

        await client.sendText(numero, mensagem);
        console.log('✅ Mensagem de ponto enviada para o WhatsApp!');
    } catch (err) {
        console.error('❌ Erro ao enviar mensagem de ponto:', err);
    }
}

// --- NOVA FUNÇÃO PARA A MENSAGEM DE RESUMO ---
async function enviarMensagemResumo(resumo) {
    try {
        const client = await iniciarWPP();
        const numero = process.env.NUMERO_OFICIAL;

        const mensagem = `📊 *Resumo do Dia - ${resumo.data}*

✅ *Suas 4 batidas do dia:*
- Entrada: ${resumo.batidas[0]}
- Saída Almoço: ${resumo.batidas[1]}
- Volta Almoço: ${resumo.batidas[2]}
- Saída: ${resumo.batidas[3]}

⏱️ *Total Trabalhado:* ${resumo.totalTrabalhado}
(Carga horária: 7h20)

⚖️ *Saldo do Dia:*
- ${resumo.tipoSaldo}: *${resumo.saldo}*`;

        await client.sendText(numero, mensagem);
        console.log('✅ Mensagem de resumo do dia enviada!');
    } catch (err) {
        console.error('❌ Erro ao enviar mensagem de resumo:', err);
    }
}

module.exports = { iniciarWPP, enviarMensagemWhatsApp, enviarMensagemResumo, enviarTexto };