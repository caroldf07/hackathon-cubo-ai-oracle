import pandas as pd
import os

def determine_tier(row):
    # Mapeamento de tipos de instância para configurações aproximadas
    instance_configs = {
        'small': {'cores': 4, 'ram': 32},
        'medium': {'cores': 8, 'ram': 64},
        'large': {'cores': 16, 'ram': 128},
        'xlarge': {'cores': 32, 'ram': 256},
        '2xlarge': {'cores': 64, 'ram': 512}
    }
    
    instance_type = row['instance_type'].lower()
    if instance_type not in instance_configs:
        return 4  # Default to lowest tier if unknown
        
    cores = instance_configs[instance_type]['cores']
    ram = instance_configs[instance_type]['ram']
    
    # Classificação por TIER baseada nas especificações
    if cores >= 32 and ram >= 256:
        return 0  # TIER 0: Sistemas críticos
    elif 16 <= cores <= 64 and 128 <= ram <= 512:
        return 1  # TIER 1: Alta criticidade
    elif 8 <= cores <= 32 and 64 <= ram <= 256:
        return 2  # TIER 2: Média-alta criticidade
    elif 4 <= cores <= 16 and 32 <= ram <= 128:
        return 3  # TIER 3: Média criticidade
    else:
        return 4  # TIER 4: Baixa criticidade

# Ler o arquivo CSV
csv_path = os.path.join(os.path.dirname(__file__), 'datadog_synthetic_metrics.csv')
df = pd.read_csv(csv_path)

# Adicionar coluna de tier
df['tier'] = df.apply(determine_tier, axis=1)

# Salvar o arquivo com a nova coluna
output_path = os.path.join(os.path.dirname(__file__), 'datadog_synthetic_metrics.csv')
df.to_csv(output_path, index=False)
print(f"\nArquivo atualizado com sucesso: {output_path}")

# Mostrar análise detalhada
print("\n=== ANÁLISE DE CLASSIFICAÇÃO POR TIER ===\n")

print("RESUMO GERAL:")
print("-" * 50)
tier_counts = df.groupby('tier').size()
total = len(df)
for tier in range(5):
    count = tier_counts.get(tier, 0)
    percentage = (count / total) * 100
    print(f"TIER {tier}: {count} recursos ({percentage:.1f}%)")

print("\nDETALHES POR TIER:")
print("-" * 50)
for tier in range(5):
    tier_df = df[df['tier'] == tier]
    if len(tier_df) > 0:
        print(f"\nTIER {tier}:")
        print("Top 5 recursos:")
        print(tier_df[['resource_name', 'instance_type', 'business_unit', 'environment']].head(5).to_string())
        
        print(f"\nDistribuição por business_unit no TIER {tier}:")
        print(tier_df['business_unit'].value_counts().to_string())
        print("\n" + "-" * 50)
