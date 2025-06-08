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
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")
      # Filtrar dados relevantes
    resource_datadog = datadog_df[datadog_df['resource_name'] == resource_name].to_dict('records')
    
    # Para demo, vamos usar o primeiro registro de FinOps disponível
    # Em um cenário real, haveria uma correspondência entre os sistemas
    if resource_datadog:
        resource_finops = finops_df.head(1).to_dict('records')  # Pega o primeiro registro como exemplo
    else:
        resource_finops = []
    
    if not resource_datadog or not resource_finops:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Definir a tool de análise de elegibilidade
    tools = [
        {
            "type": "function",
            "function": {
                "name": "analyze_resource_eligibility",
                "description": "Analisa a elegibilidade de um recurso para redimensionamento baseado em métricas do Datadog, dados FinOps e guardrails de infraestrutura.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "resource_name": {
                            "type": "string",
                            "description": "Nome do recurso sendo analisado"
                        },
                        "datadog_metrics": {
                            "type": "object",
                            "description": "Métricas do Datadog para o recurso"
                        },
                        "finops_data": {
                            "type": "object", 
                            "description": "Dados financeiros e operacionais do recurso"
                        },
                        "guardrails": {
                            "type": "string",
                            "description": "Políticas e limites de configuração para o recurso"
                        },
                        "eligibility_status": {
                            "type": "string",
                            "enum": ["eligible", "ineligible"],
                            "description": "Status de elegibilidade do recurso para redimensionamento"
                        },
                        "reasoning": {
                            "type": "string",
                            "description": "Justificativa detalhada para a decisão de elegibilidade"
                        },
                        "recommendations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Lista de recomendações específicas para o recurso"
                        }
                    },
                    "required": ["resource_name", "eligibility_status", "reasoning"]
                }
            }
        }
    ]
    
    # Preparar prompt para o LLama com tool calling
    messages = [
        {
            "role": "system",
            "content": "Você é um especialista em DevOps e FinOps. Sua função é analisar recursos de infraestrutura e determinar sua elegibilidade para redimensionamento. Use a ferramenta analyze_resource_eligibility para fornecer uma análise estruturada considerando métricas do Datadog, dados FinOps e guardrails de infraestrutura. Considere que os guardrails definem limites mínimos e máximos de configuração - recursos fora desses limites ou sugestões que violem os guardrails devem ser considerados inelegíveis."
        },
        {
            "role": "user",
            "content": f"Analise a elegibilidade do recurso '{resource_name}' para redimensionamento com base nos seguintes dados:\n\nDatadog Metrics: {json.dumps(resource_datadog, indent=2)}\n\nFinOps Data: {json.dumps(resource_finops, indent=2)}\n\nGuardrails: {guardrails}\n\nPor favor, use a ferramenta analyze_resource_eligibility para fornecer uma análise estruturada."        }
    ]
    
    # Chamada para a API da OpenAI com tools
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini-2024-07-18",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        print(f"Response: {response}")
        
        # Converter a resposta para um formato JSON serializável
        analysis = {
            "id": response.id,
            "object": response.object,
            "created": response.created,
            "model": response.model,
            "choices": [
                {
                    "index": choice.index,
                    "message": {
                        "role": choice.message.role,
                        "content": choice.message.content,
                        "tool_calls": [
                            {
                                "id": tool_call.id,
                                "type": tool_call.type,
                                "function": {
                                    "name": tool_call.function.name,
                                    "arguments": tool_call.function.arguments
                                }
                            } for tool_call in (choice.message.tool_calls or [])
                        ] if choice.message.tool_calls else None
                    },
                    "finish_reason": choice.finish_reason
                } for choice in response.choices
            ],            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            } if response.usage else None
        }
        
        return {
            "resource_name": resource_name,
            "analysis": analysis,
            "raw_data": {
                "datadog": resource_datadog,
                "finops": resource_finops
            }
        }
    except Exception as e:
        print(f"Error calling OpenAI API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calling OpenAI API: {str(e)}")

@app.get("/resources")
async def list_resources():
    try:
        datadog_df, finops_df, _ = load_data()
        resources = datadog_df['resource_name'].unique().tolist()
        return {"resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading resources: {str(e)}")

if __name__ == "__main__":
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
