from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import requests
from typing import List, Dict
import json
from pathlib import Path

app = FastAPI()

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

# Função para ler os dados do Apptio e Guardrails
def load_data():
    base_path = Path(__file__).parent.parent.parent
    
    # Carregar dados do Datadog
    datadog_path = base_path / "datadog_synthetic_metrics.csv"
    datadog_df = pd.read_csv(datadog_path)
    
    # Carregar dados do Apptio
    finops_path = base_path / "synthetic_finops_data.csv"
    finops_df = pd.read_csv(finops_path)
    
    # Carregar Guardrails
    guardrails_path = base_path / "database_infrastructure_guardrails.txt"
    with open(guardrails_path, 'r') as f:
        guardrails = f.read()
    
    return datadog_df, finops_df, guardrails

@app.post("/analyze_resource")
async def analyze_resource(resource_id: str):
    # Mock do DDoS Protection
    if not mock_ddos_protection("127.0.0.1"):
        raise HTTPException(status_code=403, detail="Potential DDoS attack detected")
    
    # Carregar dados
    try:
        datadog_df, finops_df, guardrails = load_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")
    
    # Filtrar dados relevantes
    resource_datadog = datadog_df[datadog_df['resource_id'] == resource_id].to_dict('records')
    resource_finops = finops_df[finops_df['resource_id'] == resource_id].to_dict('records')
    
    if not resource_datadog or not resource_finops:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Preparar prompt para o LLama
    messages = [
        {
            "role": "system",
            "content": "Você é um especialista em devops e finops que deve analisar os documentos do apptio e o documento de guardrail para avaliar se o recurso em questão no datadog está apto ou não a ser redimensionado. Considere que o guardrail é uma medida de controle de configurações mínimas e máxima do recurso. Caso o recurso seja elegível de ser redimensionado considerando as informações advindas do datadog e do apptio, avalie se ele também atende os guardrails. Se atender a tudo, retorne a resposta como recurso elegível e quais as sugestões de configurações novas, caso contrário retorne a resposta como recurso inelegível e justifique o porquê"
        },
        {
            "role": "user",
            "content": f"Analise o recurso com os seguintes dados:\nDatadog Metrics: {json.dumps(resource_datadog)}\nFinops Data: {json.dumps(resource_finops)}\nGuardrails: {guardrails}"
        }
    ]
    
    # Chamada para a API do LLama
    try:
        response = requests.post(
            "http://155.248.194.32:8000/v1/chat/completions",
            json={
                "model": "meta-llama/Llama-3.1-70B-Instruct",
                "messages": messages
            }
        )
        response.raise_for_status()
        analysis = response.json()
        
        return {
            "resource_id": resource_id,
            "analysis": analysis,
            "raw_data": {
                "datadog": resource_datadog,
                "finops": resource_finops
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling LLama API: {str(e)}")

@app.get("/resources")
async def list_resources():
    try:
        datadog_df, finops_df, _ = load_data()
        resources = datadog_df['resource_id'].unique().tolist()
        return {"resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading resources: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
