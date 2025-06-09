from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from typing import Dict
import json
from pathlib import Path
import uvicorn
import os
from openai import OpenAI
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

app = FastAPI()

api_key = os.getenv("OPENAI_API_KEY")
print(f"api_key: {api_key}")
# Configurar cliente OpenAI
client = OpenAI(api_key=api_key)
              
# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulação do serviço Azion DDoS Protection
def mock_ddos_protection(request_ip: str) -> bool:
    _ = request_ip  # Silencia o warning sobre parâmetro não usado
    return True  # Simula que todas as requisições são legítimas

# Tool de análise de recursos
def analyze_resource_tool(resource_name: str) -> Dict:
    """
    Análise de um recurso específico.
    Args:
        resource_name (str): Nome do recurso a ser analisado.
    Returns:
        Dict: Resultado da análise do recurso.
    """
    return {
        "resource_name": resource_name,
        "status": "eligível",  # Simula que o recurso é elegível para redimensionamento
        "details": "Resource is within the acceptable limits."
    }

# Função para ler os dados do Apptio e Guardrails
def load_data():
    base_path = Path(__file__).parent.parent.parent
      # Carregar dados do Datadog
    datadog_path = base_path / "datadog_synthetic_metrics.csv"
    datadog_df = pd.read_csv(datadog_path, encoding='utf-8')
    
    # Carregar dados do Apptio
    finops_path = base_path / "synthetic_finops_data.csv"
    finops_df = pd.read_csv(finops_path, encoding='utf-8')
    
    # Carregar Guardrails
    guardrails_path = base_path / "database_infrastructure_guardrails.txt"
    with open(guardrails_path, 'r', encoding='utf-8') as f:
        guardrails = f.read()
    
    return datadog_df, finops_df, guardrails

@app.get("/analyze_resource")
async def analyze_resource(resource_name: str = Query(..., description="Nome do recurso a ser analisado")):
    # Mock do DDoS Protection
    if not mock_ddos_protection("127.0.0.1"):
        raise HTTPException(status_code=403, detail="Potential DDoS attack detected")
      # Carregar dados
    try:
        datadog_df, finops_df, guardrails = load_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}") from e
    
    # Filtrar dados relevantes
    resource_datadog = datadog_df[datadog_df['resource_name'] == resource_name].to_dict('records')
    
    if not resource_datadog:
        raise HTTPException(status_code=404, detail="Resource not found in Datadog data")
    
    # Tentar correlacionar com dados FinOps baseado em business_unit e environment
    datadog_resource = resource_datadog[0]
    business_unit = datadog_resource.get('business_unit')
    environment = datadog_resource.get('environment')
    
    # Buscar correspondência no FinOps por business_unit e environment
    resource_finops = finops_df[
        (finops_df['business_unit'] == business_unit) & 
        (finops_df['environment'] == environment)
    ].to_dict('records')
    
    # Se não encontrar correspondência exata, usar qualquer registro do mesmo business_unit
    if not resource_finops and business_unit:
        resource_finops = finops_df[finops_df['business_unit'] == business_unit].head(1).to_dict('records')
    
    # Se ainda não encontrar, usar um registro aleatório como fallback
    if not resource_finops:
        resource_finops = finops_df.head(1).to_dict('records')
    
    if not resource_finops:
        raise HTTPException(status_code=404, detail="No FinOps data available")    # Preparar prompt para análise direta
    prompt = f"""Você é um especialista em DevOps e FinOps. Analise a conformidade do recurso '{resource_name}' com os guardrails de infraestrutura e forneça uma análise estruturada em formato JSON.

DADOS DO RECURSO:

DATADOG METRICS:
{json.dumps(resource_datadog, indent=2)}

FINOPS DATA:
{json.dumps(resource_finops, indent=2)}

GUARDRAILS:
{guardrails}

INSTRUÇÕES DE ANÁLISE:

1. VERIFICAÇÃO DE CONFORMIDADE:
   - "aprovado pelo guardrail": Configuração atual E otimizações respeitam os limites
   - "reprovado pelo guardrail": Configuração atual OU otimizações violam os limites
   - "não aplicável": Configuração atual já é a ideal em otimização e está dentro dos limites

2. OTIMIZAÇÕES (se efficiency_score < 90):
   Analise métricas para sugerir otimizações que não violem os guardrails do tier

Responda APENAS com um JSON válido no seguinte formato:
{{
  "resource_name": "{resource_name}",
  "application_tier": "TIER 3",
  "guardrail_status": "aprovado pelo guardrail" ou "reprovado pelo guardrail",
  "motivos": "Motivos específicos da aprovação/reprovação/não aplicável",
  "efficiency_score": número,
  "recommendations": ["lista", "de", "recomendações"],
  "optimization_opportunities": ["lista", "de", "oportunidades"],
  "cost_impact": "Estimativa do impacto financeiro"
}}"""
    
    # Chamada para a API da OpenAI sem tools
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini-2024-07-18",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1
        )
        print(f"Response: {response}")
        
        # Tentar fazer parse do JSON da resposta
        content = response.choices[0].message.content
        try:
            # Tentar extrair JSON da resposta
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                analysis_json = json.loads(json_match.group())
            else:
                # Se não encontrar JSON válido, criar estrutura padrão
                analysis_json = {
                    "resource_name": resource_name,
                    "application_tier": "TIER 3",
                    "tier_justification": "Análise baseada na resposta do modelo",
                    "guardrail_status": "aprovado pelo guardrail",
                    "motivos": content[:500],  # Primeiros 500 caracteres da resposta
                    "efficiency_score": resource_finops[0].get('efficiency_score', 85),
                    "recommendations": ["Verificar configurações específicas"],
                    "optimization_opportunities": ["Monitorar uso de recursos"],
                    "cost_impact": "Análise detalhada necessária"
                }
        except (json.JSONDecodeError, AttributeError) as parse_error:
            print(f"Error parsing JSON response: {parse_error}")
            # Fallback para estrutura padrão
            analysis_json = {
                "resource_name": resource_name,
                "application_tier": "TIER 3",
                "tier_justification": "Erro no parse da resposta",
                "guardrail_status": "aprovado pelo guardrail",
                "motivos": f"Erro na análise: {str(parse_error)}",
                "efficiency_score": resource_finops[0].get('efficiency_score', 85),
                "recommendations": ["Análise manual necessária"],
                "optimization_opportunities": ["Verificar configurações"],
                "cost_impact": "Não determinado"
            }
        
        return {
            "resource_name": resource_name,
            "analysis": analysis_json,
            "raw_response": content,
            "raw_data": {
                "datadog": resource_datadog,
                "finops": resource_finops
            }
        }
    except Exception as e:
        print(f"Error calling OpenAI API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calling OpenAI API: {str(e)}") from e

@app.get("/resources")
async def list_resources():
    try:
        datadog_df, _, _ = load_data()
        resources = datadog_df['resource_name'].unique().tolist()
        return {"resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading resources: {str(e)}") from e

if __name__ == "__main__":
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
