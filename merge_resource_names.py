import pandas as pd
import uuid

# Ler os arquivos CSV
datadog_df = pd.read_csv('datadog_synthetic_metrics.csv')
finops_df = pd.read_csv('synthetic_finops_data.csv')

# Função para gerar um identificador único
def generate_id():
    return str(uuid.uuid4())[:8]

# Adicionar a coluna resource_name ao finops_df
def get_resource_name(row):
    cloud = row['cloud_provider'].lower().replace(' ', '-')
    return f"{cloud}-{row['business_unit']}-db-{generate_id()}-{row['environment']}"

# Criar nova coluna resource_name
finops_df['resource_name'] = finops_df.apply(get_resource_name, axis=1)

# Reordenar as colunas para colocar resource_name após application_id
cols = list(finops_df.columns)
cols.insert(1, cols.pop(cols.index('resource_name')))
finops_df = finops_df[cols]

# Salvar o arquivo atualizado
finops_df.to_csv('synthetic_finops_data.csv', index=False)
