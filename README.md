# 🤖 PontoDona - Automação Inteligente de Registro de Ponto

O **PontoDona** é um sistema em **Node.js** desenvolvido para automatizar e gerenciar o registro de jornada de trabalho (carga horária diária de 7h20). O projeto integra e-mail, Visão Computacional (OCR), WhatsApp e Google Sheets para garantir um controle preciso do banco de horas.

---

### 🌟 Funcionalidades Principais
* **Leitura Automática (OCR):** Processa imagens de comprovantes de ponto enviadas por e-mail utilizando a API do **Google Vision AI**.
* **Gestão de Jornada:** Calcula automaticamente o saldo do dia (horas extras ou a compensar) com base na meta de 440 minutos (7h20).
* **Sincronização na Nuvem:** Registra cada batida e justificativa em tempo real em uma planilha do **Google Sheets**.
* **Relatórios Inteligentes:** Envio automático de resumo mensal de horas extras no dia 21 de cada mês.

---

### 🛠️ Comandos do WhatsApp
O robô interage via comandos de texto para facilitar o gerenciamento manual:

| Comando | Descrição |
| :--- | :--- |
| `!atestado` | Registra ausência médica, garantindo as 07:20 no banco de horas mesmo sem fotos no dia. |
| `!atestadocomp` | Para consultas no contra-turno. Calcula o tempo trabalhado e compensa o restante para fechar 07:20. |
| `!tempo` | Informa o tempo trabalhado no dia e calcula a previsão de saída (considerando 1h de intervalo). |
| `!horasextras` | Gera um relatório detalhado (por semanas e ranking) do período atual ou de um mês específico. |
| `!fechar` | Força o encerramento e registro manual do dia na planilha. |
| `!reiniciar` | Reinicia o monitoramento de e-mails em caso de falhas de conexão. |

---

### 🚀 Tecnologias e Bibliotecas
* **Runtime:** [Node.js](https://nodejs.org/)
* **WhatsApp Bot:** [WPPConnect](https://wppconnect.io/)
* **OCR:** [Google Cloud Vision API](https://cloud.google.com/vision)
* **Database:** [Google Sheets API](https://developers.google.com/sheets/api)
* **Segurança:** [Dotenv](https://www.npmjs.com/package/dotenv) para proteção de dados sensíveis

---

### 📋 Instalação e Configuração

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/seu-usuario/pontodona.git](https://github.com/seu-usuario/pontodona.git)

2. **Instale as dependências:**
   Execute o comando abaixo para instalar todos os pacotes necessários listados no `package.json`:
   ```bash
   npm install
   
3. **Configure as Variáveis de Ambiente:**
Crie um arquivo chamado `.env` na raiz do seu projeto e preencha com as suas informações conforme o modelo abaixo:


```env
GOOGLE_SHEET_ID=
NUMERO_OFICIAL=
PIX_KEY=
NOME_USUARIO=Guilherme Bastos
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app_aqui

```


4. **Credenciais do Google:**
Adicione os arquivos de chave JSON obrigatórios na pasta raiz para habilitar o OCR e a planilha:
* `google-credentials.json` (Google Sheets API)
* `google-vision-credentials.json` (Google Cloud Vision API)


5. **Inicie o robô:**
Execute o comando para iniciar o sistema e realizar a injeção das variáveis de ambiente:
```bash
node index.js

```



---

### 🚀 Tecnologias e Bibliotecas

* **Runtime:** [Node.js](https://nodejs.org/) – Ambiente de execução principal.
* **WhatsApp Bot:** [WPPConnect](https://wppconnect.io/) – Interface de comunicação via WhatsApp.
* **OCR:** [Google Cloud Vision API](https://cloud.google.com/vision) – Inteligência artificial para extração de texto de imagens.
* **Database:** [Google Sheets API](https://developers.google.com/sheets/api) – Armazenamento em tempo real das batidas de ponto.
* **Agendamento:** [Node-cron](https://www.npmjs.com/package/node-cron) – Automação de envios de relatórios periódicos.
* 
**Segurança:** [Dotenv](https://www.npmjs.com/package/dotenv) – Gerenciamento seguro de dados sensíveis e credenciais.



---

### 🛡️ Segurança de Dados

Este projeto utiliza um arquivo `.gitignore` rigoroso para garantir que informações críticas e chaves privadas nunca sejam enviadas ao repositório público:

* 
**`.env`**: Protege suas senhas de e-mail, chaves PIX e IDs de planilhas.


* 
**`*.json`**: Impede o vazamento de chaves privadas das contas de serviço do Google.


* 
**`tokens/`**: Garante que a sua sessão ativa do WhatsApp permaneça apenas no seu ambiente local.


