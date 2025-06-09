# Resource Analyzer - Oracle Hackathon

Uma aplicação inteligente para análise de recursos de infraestrutura de banco de dados usando IA, desenvolvida para o Hackathon Cubo AI Oracle. O sistema combina métricas de monitoramento do Datadog, dados financeiros (FinOps) e guardrails de infraestrutura para fornecer análises automatizadas de conformidade e otimização de recursos.

## 🎯 Objetivo

O Resource Analyzer tem como objetivo automatizar a análise de conformidade de recursos de infraestrutura de banco de dados, proporcionando:

- **Análise de Conformidade**: Verificação automática se os recursos estão de acordo com os guardrails estabelecidos
- **Otimização de Custos**: Identificação de oportunidades de otimização baseada em métricas de performance e uso
- **Classificação de Tier**: Categorização automática dos recursos em tiers de criticidade (0-3)
- **Recomendações Inteligentes**: Sugestões de melhorias usando IA (GPT-4)

## 🏗️ Arquitetura

### Backend (FastAPI + Python)
- **Framework**: FastAPI
- **IA**: OpenAI GPT-4o-mini
- **Análise de Dados**: Pandas
- **Proteção**: Mock DDoS Protection (Azion)

### Frontend (React + TypeScript)
- **Framework**: React 18 com TypeScript
- **UI**: Material-UI (MUI)
- **HTTP Client**: Axios

### Dados
- **Datadog Metrics**: Métricas de monitoramento (CPU, memória, storage, latência)
- **FinOps Data**: Dados financeiros e de eficiência
- **Guardrails**: Especificações técnicas por tier de criticidade

## 🚀 Como Executar

### Pré-requisitos
- Python 3.12+
- Node.js 16+
- Chave da API OpenAI

### Backend
```bash
cd aplicacao/backend
# Ativar ambiente virtual
.\salsicha\Scripts\activate
# Instalar dependências
pip install -r requirements.txt
# Configurar variável de ambiente
# Criar arquivo .env com: OPENAI_API_KEY=sua_chave_aqui
# Executar servidor
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd aplicacao/frontend
npm install
npm start
```

A aplicação estará disponível em:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Documentação da API: http://localhost:8000/docs

## 📊 Endpoints da API

### 1. **GET /resources**
Lista todos os recursos disponíveis para análise.

**Exemplo de Response:**
```json
{
  "resources": [
    "azure-retail-db-56afe748-prod",
    "aws-corporate-db-486923aa-hom",
    "oracle-cloud-investment-db-13cc2a89-prod"
  ]
}
```

### 2. **GET /analyze_resource**
Analisa um recurso específico usando IA.

**Parâmetros:**
- `resource_name` (query): Nome do recurso a ser analisado

**Exemplo de Request:**
```
GET /analyze_resource?resource_name=azure-retail-db-56afe748-prod
```

**Exemplo de Response:**
```json
{
  "resource_name": "azure-retail-db-56afe748-prod",
  "analysis": {
    "resource_name": "azure-retail-db-56afe748-prod",
    "application_tier": "TIER 2",
    "guardrail_status": "aprovado pelo guardrail",
    "motivos": "Recurso está dentro dos limites estabelecidos para TIER 2",
    "efficiency_score": 100.0,
    "recommendations": [
      "Manter configuração atual",
      "Monitorar picos de uso"
    ],
    "optimization_opportunities": [
      "Considerar scheduling para ambientes não-produção"
    ],
    "cost_impact": "Impacto neutro - configuração otimizada"
  },
  "raw_data": {
    "datadog": [...],
    "finops": [...]
  }
}
```

## 📈 Exemplos dos Dados

### 1. **Datadog Synthetic Metrics**
```csv
timestamp,resource_name,cloud_provider,engine,business_unit,environment,instance_type,cluster_name,cpu_utilization,memory_utilization,storage_utilization,iops,latency_ms,connections,tier
2025-06-08 21:31:33,azure-retail-db-56afe748-prod,Azure,azure-sql,retail,prod,medium,cluster-retail-prod-56afe7,48.44,63.35,68.17,2467.59,10.49,195,2
```

### 2. **Synthetic FinOps Data**
```csv
application_id,resource_name,business_unit,environment,cloud_provider,instance_type,cpu_utilization,memory_utilization,storage_utilization,monthly_cost_usd,efficiency_score,date
app-0006,azure-retail-db-56afe748-prod,retail,prod,Azure,medium,48.44,63.35,68.17,107.83,100.0,2025-06-07
```

### 3. **Oracle Cloud Infrastructure**
```csv
app-0002,oracle-cloud-investment-db-13cc2a89-prod,investment,prod,Oracle Cloud,small,29.55,54.06,49.5,73.23,84.74,2025-06-07
```

### 4. **AWS Aurora PostgreSQL**
```csv
app-0001,aws-corporate-db-486923aa-hom,corporate,prod,AWS,small,47.01,82.67,63.94,164.23,75.55,2025-06-07
```

### 5. **Azure Database Hyperscale**
```csv
app-0000,azure-corporate-db-7726be57-prod,corporate,prod,Azure,large,78.71,64.06,70.34,220.84,92.39,2025-06-07
```

## 🎯 Guardrails de Infraestrutura

O sistema utiliza guardrails estruturados em 4 tiers de criticidade:

- **TIER 0 - CRÍTICO**: Sistemas de Pagamento PIX, Core Banking (32-96 vCPUs, 256-768GB RAM)
- **TIER 1 - ALTA CRITICIDADE**: Sistemas Regulatórios, CRM (16-64 vCPUs, 128-512GB RAM)
- **TIER 2 - MÉDIA CRITICIDADE**: Aplicações Corporativas (8-32 vCPUs, 64-256GB RAM)
- **TIER 3 - BAIXA CRITICIDADE**: Desenvolvimento, Testes (2-16 vCPUs, 16-128GB RAM)

## 🖼️ Interface do Frontend

![Resource Analyzer Interface](docs/frontend-screenshot.png)

*A interface permite selecionar recursos, visualizar análises detalhadas com scores de eficiência, status de conformidade com guardrails e recomendações de otimização.*

## 🔧 Tecnologias Utilizadas

- **Backend**: Python, FastAPI, Pandas, OpenAI GPT-4
- **Frontend**: React, TypeScript, Material-UI
- **Dados**: CSV (Datadog, FinOps), TXT (Guardrails)
- **IA**: OpenAI API para análise automatizada
- **Proteção**: Mock Azion DDoS Protection

## 🏆 Diferenciais

1. **Análise Inteligente**: Uso de IA para correlacionar dados de diferentes fontes
2. **Multicloud**: Suporte para AWS, Azure e Oracle Cloud
3. **Conformidade Automatizada**: Verificação automática de guardrails
4. **Interface Intuitiva**: Dashboard responsivo com Material-UI
5. **Escalabilidade**: Arquitetura preparada para grandes volumes de dados

---

**Desenvolvido para o Hackathon Cubo AI Oracle 2025**