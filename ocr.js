const vision = require('@google-cloud/vision');
const path = require('path');

// Cria um cliente para a API do Google Vision
// Ele vai automaticamente encontrar o seu arquivo de credenciais JSON
const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, 'google-vision-credentials.json')
});

/**
 * Extrai texto de uma imagem usando a API do Google Cloud Vision AI.
 * @param {string} caminhoImagem O caminho para o arquivo de imagem local.
 * @returns {Promise<string>} O texto completo extraído da imagem.
 */
async function extrairTextoImagem(caminhoImagem) {
  try {
    console.log(`🤖 Usando Google Vision AI para ler: ${caminhoImagem}`);

    // Faz a chamada para a API, especificamente para detecção de texto em documentos
    const [result] = await client.documentTextDetection(caminhoImagem);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (fullTextAnnotation && fullTextAnnotation.text) {
      return fullTextAnnotation.text;
    } else {
      console.warn('⚠️ Google Vision: Nenhum texto encontrado na imagem.');
      return '';
    }
  } catch (erro) {
    console.error('❌ Erro na API Google Vision:', erro);
    return '';
  }
}

module.exports = { extrairTextoImagem };