import pandas as pd

def update_environment_to_prod(file_path):
    # Lê o arquivo CSV
    df = pd.read_csv(file_path)
    
    # Atualiza todos os valores da coluna 'environment' para 'prod'
    df['environment'] = 'prod'
    
    # Salva o arquivo atualizado
    df.to_csv(file_path, index=False)
    print(f'Arquivo {file_path} atualizado com sucesso!')

if __name__ == '__main__':
    # Lista de arquivos para atualizar
    files_to_update = [
        'synthetic_finops_data.csv',
        'datadog_synthetic_metrics.csv'
    ]
    
    # Atualiza cada arquivo
    for file in files_to_update:
        try:
            update_environment_to_prod(file)
        except Exception as e:
            print(f'Erro ao processar o arquivo {file}: {str(e)}')
