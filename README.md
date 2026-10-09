# LUNASYS · Gestão de Logística

Sistema web de gestão operacional de frota. Centraliza o **checklist de veículos**, o controle de **não conformidades** de viagens e um **dashboard** com indicadores, além de alertas de vencimento e exportação de relatórios, tudo em uma única interface e **sem dependência de servidor**.

**Acesse:** [infofvalentim.github.io/LUNASYS](https://infofvalentim.github.io/LUNASYS/)

---

## Funcionalidades

### ✅ Checklist Frota
- Painel de cards com o resumo da frota por status.
- Cadastro e edição de veículos com placa, vigência do checklist e status (OK, pendente ou vencido).
- Filtros por status (OK, pendentes, vencidos e à vencer em 3 dias), por data e busca por placa.
- Ordenação por qualquer coluna: placa, tipo, propriedade, data de realização, validade, prazo, status e dispositivos.
- **Renovação de validade** em um clique, informando a nova data e o novo status.
- **Banner de alerta** para checklists vencidos ou próximos do vencimento.
- Importação de planilha (`.xlsx`, `.xls` ou `.csv`).
- Exportação em **Excel**, em **PDF** e em **PDF só com os vencidos**.

### 🚨 Não Conformidades
- Registro e consulta de não conformidades por viagem, veículo, motorista e data.
- Classificação por tipo:
  - Início sem OK GS
  - Início não informado
  - SM com dados incorretos
  - Movimento indevido
  - Isca com problema
  - Interação do cliente
  - Fim não informado
  - SM enviada atrasada
  - Fora do romaneio
  - Outros
- Filtros por tipo, veículo, motorista e data, com ordenação por coluna.
- Detalhes de cada ocorrência em janela própria.
- Importação de planilha (`.xlsx`, `.xls` ou `.csv`) e exportação em Excel e PDF.

### 📊 Dashboard
- Indicadores gerais calculados a partir das não conformidades importadas.
- Seleção de período: 7, 30, 60 dias ou todo o histórico.
- Gráficos:
  - evolução temporal das NCs;
  - distribuição por tipo;
  - NCs por dia da semana;
  - top 10 veículos;
  - top 10 motoristas.
- Exportação do dashboard em PDF.

### Geral
- Tela de login, com perfil e nome do usuário exibidos no cabeçalho.
- Tema claro e escuro.
- Interface responsiva.

---

## Tecnologias

- HTML5, CSS3 e JavaScript (ES6+) puro, sem framework e sem etapa de build.
- [Chart.js](https://www.chartjs.org/) para os gráficos.
- [SheetJS (xlsx 0.18.5)](https://sheetjs.com/) para importar e exportar planilhas.
- [jsPDF 2.5.1](https://github.com/parallax/jsPDF) e [jsPDF-AutoTable 3.5.28](https://github.com/simonbengtsson/jsPDF-AutoTable) para gerar os PDFs.
- Fonte Inter (Google Fonts).
- `localStorage` do navegador para guardar os dados.

As bibliotecas são carregadas por CDN, então é preciso estar online para gráficos, importação e exportação.

---

## Estrutura do projeto

```
LUNASYS/
├── index.html   # estrutura das telas, abas e janelas (modais)
├── style.css    # estilos e temas
└── app.js       # lógica: login, frota, não conformidades e dashboard
```

---

## Como executar localmente

Não há dependências para instalar. Clone o repositório e abra o `index.html` no navegador. Se preferir rodar por um servidor local:

```bash
git clone https://github.com/infofvalentim/LUNASYS.git
cd LUNASYS
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Publicação

O projeto roda no **GitHub Pages**: em *Settings → Pages*, selecione a branch principal e a pasta raiz. Não há etapa de build.

---

## Armazenamento dos dados

Os dados ficam no `localStorage` do navegador de quem usa o sistema. Nada é enviado a servidor, e cada navegador e dispositivo tem a sua própria cópia. Por isso:

- use a exportação em Excel para fazer cópia de segurança antes de limpar os dados do navegador;
- para compartilhar informações entre pessoas, exporte e importe as planilhas.

---

## Autor

**Felipe Valentim**, Analista de Gerenciamento de Riscos | BI Logístico

[LinkedIn](https://linkedin.com/in/felipevalentiim) · [GitHub](https://github.com/infofvalentim)
