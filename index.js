require('dotenv').config(); 
const { iniciarListener, pararMailListener } = require('./imapClient');
const { iniciarWPP, enviarMensagemWhatsApp, enviarMensagemResumo, enviarTexto } = require('./whatsapp'); // Adicionamos a nova função de resumo
const { extrairTextoImagem } = require('./ocr');
const { salvarNaPlanilha } = require('./sheets');
const cron = require('node-cron');
const { calcularHorasExtras } = require('./horasExtras');
const fs = require('fs');
const eventBus = require('./eventBus');

const registrosDoDia = {};

// Em index.js

function paraHoras(min) {
    const sinal = min < 0 ? "-" : "";
    min = Math.abs(min);
    const h = Math.floor(min / 60).toString().padStart(2, "0");
    const m = (min % 60).toString().padStart(2, "0");
    return `${sinal}${h}:${m}`;
}


async function processarPontoRegistrado(dadosDoEmail) {
    for (const caminhoImagem of dadosDoEmail.caminhosDeImagem) {
        try {
            console.log(`🤖 Iniciando processamento para: ${caminhoImagem}`);
            const texto = await extrairTextoImagem(caminhoImagem);

            const pontoExtraido = {
                data: extrairCampo(texto, /Data:\s*(\d{2}\/\d{2}\/\d{4})/i),
                hora: extrairCampo(texto, /Hora:\s*(\d{2}:\d{2})/i),
                nome: extrairCampo(texto, /Nome:\s*(.*)/i),
                nsr: extrairCampo(texto, /NSR:\s*(\d+)/i),
                cnpj: extrairCampo(texto, /CNPJ:\s*([\d\.\/-]+)/i),
                registroInpi: extrairCampo(texto, /Registro\s*INPI\s*:?\s*(BR[\d-]+)/i),
                coordenadas: dadosDoEmail.coordenadas,
                totalTrabalhado: ''
            };

            const { data, hora } = pontoExtraido;

            if (data !== 'Não encontrado' && hora !== 'Não encontrado') {
                if (!registrosDoDia[data]) {
                    registrosDoDia[data] = [];
                }

                if (registrosDoDia[data].includes(hora)) {
                    console.log(`🟡 Batida duplicada ignorada: ${data} às ${hora}`);
                    fs.unlinkSync(caminhoImagem);
                    console.log(`🗑️ Arquivo de anexo duplicado removido.`);
                    continue;
                }

                registrosDoDia[data].push(hora);
                console.log(`Batidas de hoje (${data}): [${registrosDoDia[data].join(', ')}]`);

                let resumo = null;
                // Se for a 4ª batida, prepara o resumo ANTES de enviar as mensagens
                if (registrosDoDia[data].length === 4) {
                    resumo = calcularResumo(data, registrosDoDia[data]);
                    pontoExtraido.totalTrabalhado = resumo.totalTrabalhado;
                }

                // --- ORDEM CORRIGIDA ---
                // 1. Salva na planilha (com o total de horas, se for a 4ª batida)
                await salvarNaPlanilha(pontoExtraido);
                // 2. Envia a mensagem da batida individual
                await enviarMensagemWhatsApp(pontoExtraido);

                // 3. Se um resumo foi preparado, envia ele agora, por último.
                if (resumo) {
                    await enviarMensagemResumo(resumo);
                    delete registrosDoDia[data]; // Limpa a memória para o dia
                }
            }

        } catch (error) {
            console.error(`❌ Erro ao processar a imagem ${caminhoImagem}:`, error.message, error.stack);
        } finally {
            if (fs.existsSync(caminhoImagem)) {
                fs.unlinkSync(caminhoImagem);
                console.log(`🗑️ Arquivo temporário removido: ${caminhoImagem}`);
            }
        }
    }
}

// Função auxiliar para calcular minutos entre batidas (ex: "09:00" e "13:00")
function calcularDiferenca(batidas) {
    let totalMinutos = 0;
    // Assume que as batidas estão em pares (Entrada/Saída)
    for (let i = 0; i < batidas.length; i += 2) {
        if (batidas[i + 1]) {
            const [h1, m1] = batidas[i].split(':').map(Number);
            const [h2, m2] = batidas[i + 1].split(':').map(Number);
            totalMinutos += (h2 * 60 + m2) - (h1 * 60 + m1);
        }
    }
    return totalMinutos;
}

function calcularResumo(data, batidas) {
    console.log(`Calculando resumo do dia ${data}...`);
    batidas.sort();

    const [entrada1, saida1, entrada2, saida2] = batidas;

    const paraMinutos = (horaStr) => {
        const [h, m] = horaStr.split(':').map(Number);
        return h * 60 + m;
    };

    const periodoManha = paraMinutos(saida1) - paraMinutos(entrada1);
    const periodoTarde = paraMinutos(saida2) - paraMinutos(entrada2);
    const totalMinutosTrabalhados = periodoManha + periodoTarde;

    const cargaHorariaMinutos = 440; // 7h20
    const saldoMinutos = totalMinutosTrabalhados - cargaHorariaMinutos;
    const saldoAbsoluto = Math.abs(saldoMinutos);

    /*const paraHoras = (min) => {
        const h = Math.floor(min / 60).toString().padStart(2, '0');
        const m = (min % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };*/

    return {
        data,
        batidas,
        totalTrabalhado: paraHoras(totalMinutosTrabalhados),
        saldo: paraHoras(saldoAbsoluto),
        tipoSaldo: saldoMinutos >= 0 ? 'Horas Extras' : 'Horas a Compensar'
    };
}

function handleTempoCommand() {
    // --- LINHA CORRIGIDA ---
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let batidasDeHoje = registrosDoDia[hoje] || [];

    // Garante que as batidas estão em ordem cronológica para os cálculos
    batidasDeHoje.sort();

    const cargaHorariaTotalMinutos = 440; // 7 horas e 20 minutos

    const paraMinutos = (horaStr) => {
        const [h, m] = horaStr.split(':').map(Number);
        return h * 60 + m;
    };

    const paraHoras = (min) => {
        const h = Math.floor(Math.abs(min) / 60).toString().padStart(2, '0');
        const m = (Math.abs(min) % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    let minutosTrabalhados = 0;
    let minutosRestantes;
    let horaSaidaPrevista = '';

    const numBatidas = batidasDeHoje.length;

    if (numBatidas === 0) {
        return "Você ainda não registrou nenhuma batida de ponto hoje.";
    }

    if (numBatidas >= 4) {
        return "Você já completou suas 4 batidas de ponto hoje!";
    }

    if (numBatidas === 1) { // Apenas a primeira entrada
        const entradaManha = paraMinutos(batidasDeHoje[0]);
        // A hora de saída é a hora de entrada + 7h20 + 1h de almoço (estimado)
        const saidaEstimadaMinutos = entradaManha + cargaHorariaTotalMinutos + 60;
        horaSaidaPrevista = paraHoras(saidaEstimadaMinutos);
        return `Você iniciou sua jornada às *${batidasDeHoje[0]}*.
Faltam *07:20* para completar sua jornada.
Sua saída está prevista para as *${horaSaidaPrevista}* (considerando 1h de almoço).`;
    }

    if (numBatidas === 2) { // Saiu para o almoço
        minutosTrabalhados = paraMinutos(batidasDeHoje[1]) - paraMinutos(batidasDeHoje[0]);
        minutosRestantes = cargaHorariaTotalMinutos - minutosTrabalhados;
        return `Você trabalhou *${paraHoras(minutosTrabalhados)}* até agora (período da manhã).
Faltam *${paraHoras(minutosRestantes)}* para completar sua jornada.`;
    }

    if (numBatidas === 3) { // Voltou do almoço
        const periodoManha = paraMinutos(batidasDeHoje[1]) - paraMinutos(batidasDeHoje[0]);
        minutosTrabalhados = periodoManha; // O tempo trabalhado consolidado é o da manhã
        minutosRestantes = cargaHorariaTotalMinutos - minutosTrabalhados;

        const voltaAlmocoMinutos = paraMinutos(batidasDeHoje[2]);
        const horaSaidaMinutos = voltaAlmocoMinutos + minutosRestantes;
        horaSaidaPrevista = paraHoras(horaSaidaMinutos);

        return `Você já trabalhou *${paraHoras(minutosTrabalhados)}*.
Faltam *${paraHoras(minutosRestantes)}* para completar sua jornada.
Sua saída está prevista para as *${horaSaidaPrevista}*.`;
    }

    return "Não foi possível calcular o tempo. Verifique suas batidas."; // Mensagem de fallback
}

function extrairCampo(texto, regex) {
    const match = texto.match(regex);
    return match ? match[1].trim() : 'Não encontrado';
}

function executarRobo() {
    console.log('🚀 Iniciando Robô de Ponto...');
    iniciarListener(processarPontoRegistrado);
    iniciarWPP();
}

// --- PONTO DE PARTIDA ---
executarRobo();

eventBus.on('reiniciar-listener', () => {
    console.log("Evento 'reiniciar-listener' recebido! Parando listener atual...");
    pararMailListener();
    console.log("Reiniciando o robô em 5 segundos...");
    setTimeout(executarRobo, 5000);
});

eventBus.on('comando-horas-extras', async ({ from, mes }) => {
    try {
        const resultado = await calcularHorasExtras(mes);

        // Função local só pra converter saldo do ranking
        const paraHorasLocal = (min) => {
            const sinal = min < 0 ? "-" : "";
            min = Math.abs(min);
            const h = Math.floor(min / 60).toString().padStart(2, "0");
            const m = (min % 60).toString().padStart(2, "0");
            return `${sinal}${h}:${m}`;
        };

        const semanasTexto = Object.keys(resultado.relatorioDiario.semanas)
            .map(sem => {
                return `📅 *Semana ${sem}*\n${resultado.relatorioDiario.semanas[sem].join("\n")}`;
            })
            .join("\n\n");

        const top5Extras = resultado.relatorioDiario.ranking
            .slice(0, 5)
            .map(r => `⭐ ${r.data} – ${paraHorasLocal(r.saldoMin)}`)
            .join("\n");

        const mensagem = `📊 *Horas Extras – ${resultado.mes}/${resultado.ano}*

📅 *Período:* ${resultado.periodo}

———————————————
📘 *Relatório por Semana*
${semanasTexto}
———————————————
🏆 *Top 5 Dias com Mais Extras*
${top5Extras}
———————————————

⏱️ *Total trabalhado:* ${resultado.total}
⚖️ *Saldo:* ${resultado.saldo}
(${resultado.tipo})
`;

        enviarTexto(from, mensagem);

    } catch (err) {
        enviarTexto(from, "❌ Erro ao calcular horas extras.");
        console.error(err);
    }
});


eventBus.on('comando-fechamento', async ({ from, comando }) => {
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const batidas = registrosDoDia[hoje] || [];

    let statusFinal = 'Fechamento Manual';
    if (comando === '!atestado') statusFinal = 'Atestado Médico';
    if (comando === '!atestadocomp') statusFinal = 'Atestado de Comparecimento';

    // Se for atestado médico total, permitimos salvar mesmo com 0 batidas
    if (batidas.length === 0 && comando !== '!atestado') {
        return enviarTexto(from, "⚠️ Nenhuma batida registrada hoje para fechar.");
    }

    try {
        let totalFinal = "00:00";
        let observacao = statusFinal;

        if (comando === '!atestadocomp') {
            const cargaAlvo = 440; // 7h20 em minutos
            const minTrabalhados = calcularDiferenca(batidas);
            const faltante = cargaAlvo - minTrabalhados;

            if (faltante > 0) {
                observacao += ` (Compensado +${paraHoras(faltante)})`;
            }
            totalFinal = "07:20"; // Força o total de 7h20 no sistema
        } else if (comando === '!atestado') {
            totalFinal = "07:20"; // Atestado também conta como dia cheio
        } else {
            totalFinal = paraHoras(calcularDiferenca(batidas));
        }

        await salvarNaPlanilha({
            data: hoje,
            hora: batidas.length > 0 ? batidas[batidas.length - 1] : '--:--',
            nome: process.env.NOME_USUARIO || 'Guilherme',
            totalTrabalhado: totalFinal,
            status: observacao
        });

        enviarTexto(from, `✅ Dia encerrado: *${statusFinal}*\n⏱️ Total: ${totalFinal}`);
        delete registrosDoDia[hoje];

    } catch (err) {
        enviarTexto(from, "❌ Erro ao processar comando de fechamento.");
        console.error(err);
    }
});


eventBus.on('comando-tempo', ({ from }) => {
    // Chama a função que já existe para calcular a resposta
    const resposta = handleTempoCommand();
    // Usa a nova função importada para enviar a resposta
    enviarTexto(from, resposta);
});

// === AGENDAMENTO AUTOMÁTICO ===
// Todo dia 21 às 08:00
cron.schedule('0 8 21 * *', async () => {
    console.log("⏰ Executando envio automático do relatório mensal...");

    try {
        // mês atual automaticamente
        const resultado = await calcularHorasExtras(null);

        const mensagem = `📊 *Relatório Mensal Automático – ${resultado.mes}/${resultado.ano}*

📅 *Período:* ${resultado.periodo}

⏱️ *Total trabalhado:* ${resultado.total}
📘 *Carga mensal:* ${resultado.carga}

⚖️ *Saldo:* ${resultado.saldo}
(${resultado.tipo})

📨 Envio automático dia 21.`;

        // Envia para o seu número oficial de recebimento
        await enviarTexto(process.env.NUMERO_OFICIAL, mensagem);

        console.log("📤 Envio automático concluído!");
    } catch (err) {
        console.error("❌ Erro no envio automático:", err);
    }
});

module.exports = { executarRobo, handleTempoCommand };