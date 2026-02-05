const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./google-credentials.json');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;  

const auth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function salvarNaPlanilha(dados) {
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // Mapeamento corrigido para incluir a coluna de Status/Observação
    await sheet.addRow({
      Data: dados.data,
      Hora: dados.hora || '--:--', // Fallback caso não tenha batida
      Nome: dados.nome,
      NSR: dados.nsr || 'MANUAL',
      CNPJ: dados.cnpj || '-',
      'Registro INPI': dados.registroInpi || '-',
      Coordenadas: dados.coordenadas || 'Comando Manual',
      'Total Trabalhado': dados.totalTrabalhado,
      'Status': dados.status // Certifique-se que sua planilha tem uma coluna escrita "Status"
    });

    console.log('✅ Registro salvo na planilha com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao salvar na planilha:', err);
  }
}

module.exports = { salvarNaPlanilha };