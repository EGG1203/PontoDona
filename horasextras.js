// horasExtras.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./google-credentials.json');

const SHEET_ID = process.env.GOOGLE_SHEET_ID; 

// Autenticação
const auth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Converte HH:MM → minutos
function paraMinutos(horaStr) {
  if (!horaStr || typeof horaStr !== "string") return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

// Converte minutos → HH:MM
function paraHoras(min) {
  const sinal = min < 0 ? "-" : "";
  min = Math.abs(min);
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${sinal}${h}:${m}`;
}

function gerarRelatorioDiario(dias, inicioPeriodo) {
  const cargaDiaria = 440; // 7h20
  let linhas = [];
  let totalTrabalhoMes = 0;
  let saldoMensalMin = 0;

  let semanas = {};      // agrupamento por semana
  let ranking = [];      // top dias

  const dataInicio = inicioPeriodo;

  for (const dataStr of Object.keys(dias).sort((a, b) => {
    const [d1, m1, y1] = a.split('/').map(Number);
    const [d2, m2, y2] = b.split('/').map(Number);
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  })) {

    const batidas = dias[dataStr];
    batidas.sort();

    let totalDia = 0;
    let completo = true;

    if (batidas.length === 2) {
      const m1 = paraMinutos(batidas[0]);
      const m2 = paraMinutos(batidas[1]);
      if (m2 > m1) totalDia = m2 - m1;
      else completo = false;

    } else if (batidas.length === 4) {
      const [e1, s1, e2, s2] = batidas.map(paraMinutos);
      if (s1 > e1) totalDia += (s1 - e1);
      else completo = false;
      if (s2 > e2) totalDia += (s2 - e2);
      else completo = false;

    } else {
      completo = false;
    }

    // Dia incompleto
    if (!completo) {
      ranking.push({ data: dataStr, saldoMin: -999999 }); // ignora
      continue;
    }

    // Calcular saldo do dia
    const saldoDia = totalDia - cargaDiaria;
    totalTrabalhoMes += totalDia;
    saldoMensalMin += saldoDia;

    ranking.push({ data: dataStr, saldoMin: saldoDia });

    // Descobrir qual semana é baseado na diferença desde o dia 21
    const [dia, mes, ano] = dataStr.split("/").map(Number);
    const atual = new Date(ano, mes - 1, dia);

    const diff = Math.floor((atual - dataInicio) / (1000 * 60 * 60 * 24));
    const semana = Math.floor(diff / 7) + 1;

    if (!semanas[semana]) semanas[semana] = [];

    const emoji = saldoDia >= 0 ? "🟩" : "🟥";
    const sinal = saldoDia >= 0 ? "+" : "−";

    semanas[semana].push(
      `${emoji} ${dataStr} – ${paraHoras(totalDia)} (${sinal}${paraHoras(Math.abs(saldoDia))})`
    );
  }

  return {
    semanas,
    ranking: ranking
      .filter(r => r.saldoMin !== -999999)
      .sort((a, b) => b.saldoMin - a.saldoMin),
    totalTrabalhoMes,
    saldoMensalMin
  };
}

/* ---------------------------------------------------------
   GERADOR DO RELATÓRIO DIÁRIO + SEMANAS + RANKING
--------------------------------------------------------- */
/*function gerarRelatorioDiario(dias) {
  const cargaDiaria = 440; // 7h20
  let linhas = [];
  let totalTrabalhoMes = 0;
  let saldoMensalMin = 0;

  for (const data in dias) {
    const batidas = dias[data];
    batidas.sort();

    let totalDia = 0;
    let completo = true;

    if (batidas.length === 2) {
      const m1 = paraMinutos(batidas[0]);
      const m2 = paraMinutos(batidas[1]);
      if (m2 > m1) totalDia = m2 - m1;
      else completo = false;

    } else if (batidas.length === 4) {
      const [e1, s1, e2, s2] = batidas.map(paraMinutos);
      if (s1 > e1) totalDia += (s1 - e1);
      else completo = false;
      if (s2 > e2) totalDia += (s2 - e2);
      else completo = false;

    } else {
      completo = false;
    }

    if (!completo) {
      linhas.push(`🟨 ${data} – — INCOMPLETO —`);
      continue;
    }

    totalTrabalhoMes += totalDia;

    const saldoDia = totalDia - cargaDiaria;
    saldoMensalMin += saldoDia;

    const saldoStr = `${saldoDia >= 0 ? "+" : ""}${paraHoras(Math.abs(saldoDia))}`;
    const cor = saldoDia >= 0 ? "🟩" : "🟥";

    linhas.push(`${cor} ${data} – ${paraHoras(totalDia)} (${saldoStr})`);
  }

  // Organizar por semanas
  let semanas = {};

  linhas.forEach(item => {
    const data = item.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    if (!data) return;

    const [dia, mes, ano] = data.split("/").map(Number);
    const d = new Date(ano, mes - 1, dia);
    const semana = Math.ceil((d.getDate() - d.getDay()) / 7) + 1;

    if (!semanas[semana]) semanas[semana] = [];
    semanas[semana].push(item);
  });

  // Ranking dos maiores saldos
  const ranking = [...linhas]
    .filter(l => l.includes("("))
    .map(l => {
      const data = l.match(/\d{2}\/\d{2}\/\d{4}/)[0];
      const saldoStr = l.match(/\((.*?)\)/)[1];
      const negativo = saldoStr.startsWith("-");
      const [h, m] = saldoStr.replace("+", "").replace("-", "").split(":").map(Number);
      const saldoMin = h * 60 + m;
      return { data, saldoMin: negativo ? -saldoMin : saldoMin };
    })
    .sort((a, b) => b.saldoMin - a.saldoMin);

  return {
    linhas,
    semanas,
    ranking,
    totalTrabalhoMes,
    saldoMensalMin
  };
}*/

/* ---------------------------------------------------------
   CÁLCULO PRINCIPAL
--------------------------------------------------------- */
function calcularIntervalo(mesInput) {
  const hoje = new Date();
  let mes, ano;

  if (!mesInput) {
    mes = hoje.getMonth() + 1;
    ano = hoje.getFullYear();
  } else {
    const meses = {
      janeiro: 1, fevereiro: 2, marco: 3, março: 3,
      abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8,
      setembro: 9, outubro: 10, novembro: 11, dezembro: 12
    };

    if (isNaN(mesInput)) {
      mes = meses[mesInput.toLowerCase()] || (hoje.getMonth() + 1);
      ano = hoje.getFullYear();
    } else {
      mes = Number(mesInput);
      ano = hoje.getFullYear();
    }
  }

  const inicio = new Date(ano, mes - 1, 21);
  const fim = new Date(ano, mes, 20);
  return { inicio, fim, mes, ano };
}

async function calcularHorasExtras(mesSolicitado) {
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.loadHeaderRow();

  const linhas = await sheet.getRows();
  const { inicio, fim, mes, ano } = calcularIntervalo(mesSolicitado);

  // Agrupar batidas por dia
  const dias = {};

  for (const row of linhas) {
    const raw = row._rawData;
    if (!raw || raw.length < 2) continue;

    const dataStr = raw[0];
    const horaStr = raw[1];
    if (!dataStr || !horaStr) continue;

    const [dia, mesR, anoR] = dataStr.split('/').map(Number);
    const dataRow = new Date(anoR, mesR - 1, dia);

    if (dataRow < inicio || dataRow > fim) continue;

    if (!dias[dataStr]) dias[dataStr] = [];
    dias[dataStr].push(horaStr);
  }

  // gera relatório diário (semanas, ranking, total do mês, saldo mensal)
  const relatorio = gerarRelatorioDiario(dias, inicio);

  // retorna usando os valores calculados no relatório
  return {
    periodo: `${inicio.toLocaleDateString('pt-BR')} → ${fim.toLocaleDateString('pt-BR')}`,
    mes,
    ano,
    total: paraHoras(relatorio.totalTrabalhoMes),
    carga: paraHoras(220 * 60),
    saldo: paraHoras(relatorio.saldoMensalMin),
    tipo: relatorio.saldoMensalMin >= 0 ? "Horas Extras" : "Horas a Compensar",
    relatorioDiario: relatorio
  };
}


module.exports = { calcularHorasExtras };
