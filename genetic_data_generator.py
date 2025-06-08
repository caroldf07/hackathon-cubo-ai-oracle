import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

class GeneticDataGenerator:
    def __init__(self, population_size=100):
        self.population_size = population_size
        self.mutation_rate = 0.1
        self.crossover_rate = 0.7
          # Carregar dados existentes
        self.finops_data = pd.read_csv('c:/Users/80606/Downloads/hackathon-cubo-ai-oracle/synthetic_finops_data.csv')
        self.datadog_metrics = pd.read_csv('c:/Users/80606/Downloads/hackathon-cubo-ai-oracle/datadog_synthetic_metrics.csv')
        
        # Definir ranges válidos baseados nos dados existentes
        self.ranges = {
            'cpu_utilization': (self.finops_data['cpu_utilization'].min(), self.finops_data['cpu_utilization'].max()),
            'memory_utilization': (self.finops_data['memory_utilization'].min(), self.finops_data['memory_utilization'].max()),
            'storage_utilization': (self.finops_data['storage_utilization'].min(), self.finops_data['storage_utilization'].max()),
            'monthly_cost_usd': (self.finops_data['monthly_cost_usd'].min(), self.finops_data['monthly_cost_usd'].max()),
            'efficiency_score': (self.finops_data['efficiency_score'].min(), self.finops_data['efficiency_score'].max())
        }
        
        # Coletar valores únicos para campos categóricos
        self.categorical_values = {
            'business_unit': self.finops_data['business_unit'].unique(),
            'environment': self.finops_data['environment'].unique(),
            'cloud_provider': self.finops_data['cloud_provider'].unique(),
            'instance_type': self.finops_data['instance_type'].unique()
        }

    def generate_individual(self):
        """Gera um indivíduo aleatório com características válidas"""
        business_unit = np.random.choice(self.categorical_values['business_unit'])
        environment = np.random.choice(self.categorical_values['environment'])
        cloud_provider = np.random.choice(self.categorical_values['cloud_provider'])
        instance_type = np.random.choice(self.categorical_values['instance_type'])
        
        # Gerar resource_name seguindo o padrão
        provider_prefix = cloud_provider.lower().replace(' ', '-')
        resource_name = f"{provider_prefix}-{business_unit.lower()}-db-{random.randint(0, 999999):06x}-{environment.lower()}"
          return {
            'resource_name': resource_name,
            'business_unit': business_unit,
            'environment': environment,
            'cloud_provider': cloud_provider,
            'instance_type': instance_type,
            'application_id': f'app-{random.randint(0, 9999):04d}',
            'cpu_utilization': np.random.uniform(*self.ranges['cpu_utilization']),
            'memory_utilization': np.random.uniform(*self.ranges['memory_utilization']),
            'storage_utilization': np.random.uniform(*self.ranges['storage_utilization']),
            'monthly_cost_usd': np.random.uniform(*self.ranges['monthly_cost_usd']),
            'efficiency_score': np.random.uniform(*self.ranges['efficiency_score']),
            'date': (datetime.now() + timedelta(days=random.randint(0, 365))).strftime('%Y-%m-%d')
        }

    def fitness(self, individual):
        """Avalia a qualidade do indivíduo baseado em regras de negócio"""
        score = 0
        
        # Regra 1: Utilização balanceada de recursos
        utilization_std = np.std([
            individual['cpu_utilization'],
            individual['memory_utilization'],
            individual['storage_utilization']
        ])
        score -= utilization_std  # Quanto menor o desvio padrão, melhor
        
        # Regra 2: Eficiência de custo
        if individual['efficiency_score'] > 90:
            score += 10
        
        # Regra 3: Utilização adequada de recursos
        avg_utilization = (individual['cpu_utilization'] + 
                         individual['memory_utilization'] + 
                         individual['storage_utilization']) / 3
        if 40 <= avg_utilization <= 80:  # Range ideal de utilização
            score += 5
            
        return score

    def crossover(self, parent1, parent2):
        """Realiza crossover entre dois indivíduos"""
        if random.random() > self.crossover_rate:
            return parent1, parent2

        child1 = parent1.copy()
        child2 = parent2.copy()
        
        # Crossover para campos numéricos
        numeric_fields = ['cpu_utilization', 'memory_utilization', 'storage_utilization', 
                         'monthly_cost_usd', 'efficiency_score']
        
        for field in numeric_fields:
            if random.random() < 0.5:
                child1[field], child2[field] = child2[field], child1[field]
        
        return child1, child2

    def mutate(self, individual):
        """Aplica mutação em um indivíduo"""
        if random.random() > self.mutation_rate:
            return individual

        mutated = individual.copy()
        
        # Mutação em campos numéricos
        if random.random() < 0.3:
            field = random.choice(['cpu_utilization', 'memory_utilization', 'storage_utilization',
                                 'monthly_cost_usd', 'efficiency_score'])
            mutated[field] = np.random.uniform(*self.ranges[field])
        
        # Mutação em campos categóricos
        if random.random() < 0.2:
            field = random.choice(['business_unit', 'environment', 'cloud_provider', 'instance_type'])
            mutated[field] = np.random.choice(self.categorical_values[field])
            
            # Atualizar resource_name se necessário
            if field in ['business_unit', 'environment', 'cloud_provider']:
                provider_prefix = mutated['cloud_provider'].lower().replace(' ', '-')
                mutated['resource_name'] = f"{provider_prefix}-{mutated['business_unit'].lower()}-db-{random.randint(0, 999999):06x}-{mutated['environment'].lower()}"
        
        return mutated

    def evolve(self, generations=50):
        """Executa o algoritmo genético"""
        # População inicial
        population = [self.generate_individual() for _ in range(self.population_size)]
        
        for generation in range(generations):
            # Avaliar fitness
            fitness_scores = [(ind, self.fitness(ind)) for ind in population]
            fitness_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Selecionar melhores indivíduos
            elite_size = int(0.1 * self.population_size)
            new_population = [ind for ind, _ in fitness_scores[:elite_size]]
            
            # Crossover e mutação
            while len(new_population) < self.population_size:
                parent1 = random.choice([ind for ind, _ in fitness_scores[:int(self.population_size/2)]])
                parent2 = random.choice([ind for ind, _ in fitness_scores[:int(self.population_size/2)]])
                
                child1, child2 = self.crossover(parent1, parent2)
                child1 = self.mutate(child1)
                child2 = self.mutate(child2)
                
                new_population.extend([child1, child2])
            
            population = new_population[:self.population_size]
            
            if (generation + 1) % 10 == 0:
                print(f"Geração {generation + 1} completa")
        
        return population

def main():
    # Criar gerador genético
    generator = GeneticDataGenerator(population_size=200)
    
    # Evolução
    print("Iniciando evolução...")
    new_population = generator.evolve(generations=50)
    
    # Converter para DataFrame
    new_data = pd.DataFrame(new_population)
    
    # Manter a ordem exata das colunas do arquivo original
    columns = ['resource_name', 'business_unit', 'environment', 'cloud_provider', 'instance_type', 
               'application_id', 'cpu_utilization', 'memory_utilization', 'storage_utilization', 
               'monthly_cost_usd', 'efficiency_score', 'date']
    new_data = new_data[columns]
    
    # Combinar dados existentes com novos dados
    existing_data = pd.read_csv('c:/Users/80606/Downloads/hackathon-cubo-ai-oracle/synthetic_finops_data.csv')
    combined_data = pd.concat([existing_data, new_data], ignore_index=True)
    
    # Manter a ordem das colunas
    combined_data = combined_data[columns]
    
    # Salvar resultados
    combined_data.to_csv('c:/Users/80606/Downloads/hackathon-cubo-ai-oracle/synthetic_finops_data_enhanced.csv', index=False)
    print("Dados gerados e salvos em 'synthetic_finops_data_enhanced.csv'")

if __name__ == "__main__":
    main()
