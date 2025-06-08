import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  AppBar,
  Toolbar,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import axios from 'axios';

interface AnalysisResult {
  resource_name: string;
  guardrails: string;
  eligibility_status: string;
  reasoning: string;
  recommendations: string[];
}

interface Resource {
  resource_name: string;
  analysis: any;
  raw_data: {
    datadog: any[];
    finops: any[];
  };
}

function App() {
  const [resources, setResources] = useState<string[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [analysis, setAnalysis] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const response = await axios.get('http://localhost:8000/resources');
        setResources(response.data.resources);
        setLoading(false);
      } catch (err) {
        setError('Error loading resources');
        setLoading(false);
      }
    };

    fetchResources();
  }, []);

  const analyzeResource = async (resourceName: string) => {
    if (!resourceName) return;
    
    setAnalyzing(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:8000/analyze_resource', {
        params: { resource_name: resourceName }
      });
      setAnalysis(response.data);
    } catch (err) {      setError(`Error analyzing resource ${resourceName}`);
      console.error(`Error analyzing resource ${resourceName}:`, err);
    } finally {
      setAnalyzing(false);
    }
  };
  const handleResourceChange = (resourceName: string) => {
    setSelectedResource(resourceName);
    setAnalysis(null);
  };
  const extractAnalysisContent = (analysisData: any) => {
    try {
      let analysisResult: AnalysisResult | null = null;

      // Tentar extrair dados da nova estrutura do backend
      if (analysisData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
        try {
          const argumentsStr = analysisData.choices[0].message.tool_calls[0].function.arguments;
          analysisResult = JSON.parse(argumentsStr);
        } catch (parseError) {
          console.error('Error parsing tool_calls arguments:', parseError);
        }
      }

      // Fallback para estrutura antiga ou dados diretos
      if (!analysisResult) {
        if (analysisData?.resource_name && analysisData?.eligibility_status) {
          analysisResult = analysisData;
        } else {
          // Fallback para análise de texto antiga
          return extractLegacyAnalysisContent(analysisData);
        }
      }

      if (!analysisResult) {
        throw new Error('Unable to parse analysis data');
      }

      const isEligible = analysisResult.eligibility_status?.toLowerCase() === 'eligible';
      
      // Organizar recomendações por categorias
      const recommendationTopics: { [key: string]: string[] } = {
        'Processamento': [],
        'Memória': [],
        'Armazenamento': [],
        'Rede': [],
        'Configuração Geral': []
      };

      // Categorizar recomendações
      if (analysisResult.recommendations && Array.isArray(analysisResult.recommendations)) {
        analysisResult.recommendations.forEach(rec => {
          const recLower = rec.toLowerCase();
          if (/\b(vcpu|cores?|cpu|processamento|processor|compute)\b/i.test(rec)) {
            recommendationTopics['Processamento'].push(rec);
          } else if (/\b(memória|memory|ram|gb.*mem|mem.*gb)\b/i.test(rec)) {
            recommendationTopics['Memória'].push(rec);
          } else if (/\b(armazenamento|storage|disco|disk|tb|volume)\b/i.test(rec)) {
            recommendationTopics['Armazenamento'].push(rec);
          } else if (/\b(rede|network|bandwidth|largura.*banda|gbps|conectividade)\b/i.test(rec)) {
            recommendationTopics['Rede'].push(rec);
          } else {
            recommendationTopics['Configuração Geral'].push(rec);
          }
        });
      }

      // Filtrar tópicos vazios
      const filteredTopics: { [key: string]: string[] } = {};
      Object.entries(recommendationTopics).forEach(([topic, items]) => {
        if (items.length > 0) {
          filteredTopics[topic] = items.slice(0, 3); // Mostrar até 3 itens por categoria
        }
      });

      // Processar razões de inelegibilidade
      const ineligibilityReasons: string[] = [];
      if (!isEligible && analysisResult.reasoning) {
        // Dividir o reasoning em frases mais legíveis
        const sentences = analysisResult.reasoning.split(/[.!?]+/).filter(s => s.trim().length > 20);
        ineligibilityReasons.push(...sentences.slice(0, 3).map(s => s.trim()));
      }

      return {
        isEligible,
        recommendationTopics: filteredTopics,
        ineligibilityReasons,
        summary: analysisResult.reasoning || 'Análise concluída.',
        guardrails: analysisResult.guardrails || '',
        resourceName: analysisResult.resource_name || ''
      };

    } catch (error) {
      console.error('Error extracting analysis content:', error);
      return {
        isEligible: false,
        recommendationTopics: {},
        ineligibilityReasons: ['Erro ao processar análise: ' + error.message],
        summary: 'Erro ao processar análise',
        guardrails: '',
        resourceName: ''
      };
    }
  };
  // Função auxiliar para compatibilidade com formato antigo
  const extractLegacyAnalysisContent = (analysisData: any) => {
    try {
      // Extrair o conteúdo da análise (formato antigo)
      let content = '';
      if (analysisData.choices && analysisData.choices[0] && analysisData.choices[0].message) {
        content = analysisData.choices[0].message.content;
      } else if (typeof analysisData === 'string') {
        content = analysisData;
      } else {
        content = JSON.stringify(analysisData);
      }

      // Determinar elegibilidade com maior precisão
      const contentLower = content.toLowerCase();
      const isEligible = (contentLower.includes('elegível') || contentLower.includes('eligible')) && 
                        !contentLower.includes('não elegível') && 
                        !contentLower.includes('inelegível') &&
                        !contentLower.includes('not eligible');

      // Agrupar recomendações por tópicos de forma mais inteligente
      const recommendationTopics: { [key: string]: string[] } = {
        'Processamento': [],
        'Memória': [],
        'Armazenamento': [],
        'Rede': [],
        'Configuração Geral': []
      };

      const ineligibilityReasons: string[] = [];
      const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 50);

      // Extrair informações de forma mais inteligente
      if (isEligible) {
        for (const line of lines) {
          const cleanLine = line.replace(/^[\s*+\-•►]\s*/, '').trim();
          if (cleanLine.length < 20) continue;

          // Categorizar por palavras-chave mais específicas
          if (/\b(vCPU|cores?|CPU|processamento|processor|compute)\b/i.test(cleanLine)) {
            if (!recommendationTopics['Processamento'].some(item => item.includes(cleanLine.substring(0, 30)))) {
              recommendationTopics['Processamento'].push(cleanLine);
            }
          } else if (/\b(memória|memory|RAM|GB.*mem|mem.*GB)\b/i.test(cleanLine)) {
            if (!recommendationTopics['Memória'].some(item => item.includes(cleanLine.substring(0, 30)))) {
              recommendationTopics['Memória'].push(cleanLine);
            }
          } else if (/\b(armazenamento|storage|disco|disk|TB|volume)\b/i.test(cleanLine)) {
            if (!recommendationTopics['Armazenamento'].some(item => item.includes(cleanLine.substring(0, 30)))) {
              recommendationTopics['Armazenamento'].push(cleanLine);
            }
          } else if (/\b(rede|network|bandwidth|largura.*banda|Gbps|conectividade)\b/i.test(cleanLine)) {
            if (!recommendationTopics['Rede'].some(item => item.includes(cleanLine.substring(0, 30)))) {
              recommendationTopics['Rede'].push(cleanLine);
            }
          } else if (/\b(configuração|config|otimização|optimization|sugest|recomend|tier|instance|scaling)\b/i.test(cleanLine)) {
            if (!recommendationTopics['Configuração Geral'].some(item => item.includes(cleanLine.substring(0, 30)))) {
              recommendationTopics['Configuração Geral'].push(cleanLine);
            }
          }
        }
      } else {
        // Extrair razões de inelegibilidade de forma mais precisa
        for (const line of lines) {
          const cleanLine = line.replace(/^[\s*+\-•►]\s*/, '').trim();
          if (cleanLine.length < 30) continue;

          if (/\b(não.*elegível|inelegível|não.*otimiz|adequado|eficiente|within.*limits|already.*optimized|sufficient|appropriate)\b/i.test(cleanLine) ||
              /\b(utilização.*adequada|performance.*satisfatória|recursos.*suficientes|dentro.*limites|bem.*dimensionado)\b/i.test(cleanLine)) {
            if (!ineligibilityReasons.some(reason => reason.includes(cleanLine.substring(0, 30)))) {
              ineligibilityReasons.push(cleanLine);
            }
          }
        }
      }

      // Limitar e filtrar tópicos
      const filteredTopics: { [key: string]: string[] } = {};
      Object.entries(recommendationTopics).forEach(([topic, items]) => {
        if (items.length > 0) {
          filteredTopics[topic] = items.slice(0, 2).map(item => 
            item.length > 80 ? item.substring(0, 80) + '...' : item
          );
        }
      });

      // Extrair resumo conciso focado no resultado final
      let summary = '';
      const summaryPatterns = [
        /(?:resposta\s+final|conclusão|resultado|avaliação):\s*(.+?)(?:\n\n|\*\*|$)/i,
        /(?:elegível|inelegível).*?\.(.+?)(?:\n\n|\*\*|$)/i,
        /(?:portanto|assim|dessa\s+forma|em\s+resumo)[\s:,]*(.+?)(?:\n\n|\*\*|$)/i
      ];

      for (const pattern of summaryPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          summary = match[1].trim();
          break;
        }
      }

      if (!summary) {
        // Fallback: pegar as últimas frases significativas
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
        summary = sentences.slice(-2).join('. ').trim() + '.';
      }

      return {
        isEligible,
        recommendationTopics: filteredTopics,
        ineligibilityReasons: ineligibilityReasons.slice(0, 4).map(reason => 
          reason.length > 120 ? reason.substring(0, 120) + '...' : reason
        ),
        summary: summary.substring(0, 350) + (summary.length > 350 ? '...' : ''),
        guardrails: '',
        resourceName: ''
      };
    } catch (error) {
      console.error('Error extracting legacy analysis content:', error);
      return {
        isEligible: false,
        recommendationTopics: {},
        ineligibilityReasons: ['Erro ao processar análise'],
        summary: 'Erro ao processar análise',
        guardrails: '',
        resourceName: ''
      };
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  return (
    <>
      <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            🤖 HelpAI Dashboard
          </Typography>
          <Chip label="Hackathon Demo" color="secondary" />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg">
        <Box py={4}>
          <Box mb={4}>
            <Typography variant="h4" gutterBottom align="center" color="primary">
              Análise de otimização de recursos de nuvem com IA
            </Typography>
            <Typography variant="body1" align="center" color="textSecondary" paragraph>
              Selecione um recurso para analisar seu potencial de otimização usando insights baseados em IA a partir de métricas do Datadog, dados FinOps e guardrails de infraestrutura.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3 }}>                <Typography variant="h6" gutterBottom>
                  Selecione o Recurso
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Escolha um recurso para ser analisado</InputLabel>
                  <Select
                    value={selectedResource}
                    onChange={(e) => handleResourceChange(e.target.value)}
                    label="Escolha um recurso para ser analisado"
                  >                    {resources.slice(0, 50).map((resource) => (
                      <MenuItem key={resource} value={resource}>
                        {resource}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button 
                  variant="contained" 
                  fullWidth 
                  sx={{ mt: 2 }}
                  onClick={() => analyzeResource(selectedResource)}
                  disabled={!selectedResource || analyzing}
                >
                  {analyzing ? 'Analisando...' : 'Analisar'}
                </Button>
                {resources.length > 50 && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Mostrando 50 de {resources.length} recursos disponívels.
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3, minHeight: 300 }}>                <Typography variant="h6" gutterBottom>
                  Resultados
                </Typography>
                {analyzing && (
                  <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={4}>
                    <CircularProgress />
                    <Typography>Analisando...</Typography>
                  </Box>
                )}                {analysis && !analyzing && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Resource: <strong>{analysis.resource_name}</strong>
                    </Typography>
                    {(() => {
                      const analysisResult = extractAnalysisContent(analysis.analysis);
                      return (
                        <Box mt={2}>                          {/* Status de Elegibilidade */}
                          <Box 
                            display="flex" 
                            alignItems="center" 
                            gap={1} 
                            mb={2}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              backgroundColor: analysisResult.isEligible ? '#e8f5e8' : '#ffebee',
                              border: `2px solid ${analysisResult.isEligible ? '#4caf50' : '#f44336'}`
                            }}
                          >
                            <Box 
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                backgroundColor: analysisResult.isEligible ? '#4caf50' : '#f44336',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            >
                              {analysisResult.isEligible ? '✓' : '✗'}                            </Box>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                color: analysisResult.isEligible ? '#2e7d32' : '#d32f2f',
                                fontWeight: 'bold',
                                fontSize: '1rem'
                              }}
                            >
                              {analysisResult.isEligible ? '🚀 ELEGÍVEL PARA OTIMIZAÇÃO' : '⚠️ NÃO ELEGÍVEL PARA OTIMIZAÇÃO'}
                            </Typography>
                          </Box>

                          {/* Informações dos Guardrails */}
                          {analysisResult.guardrails && (
                            <Box 
                              mb={2}
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: '#f5f5f5',
                                border: '1px solid #e0e0e0'
                              }}
                            >
                              <Typography 
                                variant="subtitle2" 
                                gutterBottom 
                                sx={{ 
                                  fontWeight: 'bold', 
                                  color: '#1976d2',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                🛡️ Guardrails de Infraestrutura
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontSize: '0.8rem',
                                  lineHeight: 1.4,
                                  color: '#424242',
                                  whiteSpace: 'pre-line'
                                }}
                              >
                                {analysisResult.guardrails}
                              </Typography>
                            </Box>
                          )}{/* Recomendações por tópicos ou razões de inelegibilidade */}
                          {analysisResult.isEligible && Object.keys(analysisResult.recommendationTopics).length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                📋 Recomendações de Otimização por Categoria:
                              </Typography>
                              {Object.entries(analysisResult.recommendationTopics).map(([topic, recommendations]) => (
                                <Box key={topic} mb={1.5}>
                                  <Typography variant="subtitle2" sx={{ 
                                    fontWeight: 'bold', 
                                    color: '#2e7d32',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mb: 0.5
                                  }}>
                                    {topic === 'Processamento' && '⚙️'}
                                    {topic === 'Memória' && '🧠'}
                                    {topic === 'Armazenamento' && '💾'}
                                    {topic === 'Rede' && '🌐'}
                                    {topic === 'Configuração Geral' && '🔧'}
                                    {topic}
                                  </Typography>
                                  <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
                                    {recommendations.map((rec, index) => (
                                      <Typography 
                                        component="li" 
                                        key={index} 
                                        variant="body2" 
                                        sx={{ 
                                          mb: 0.3, 
                                          fontSize: '0.85rem',
                                          lineHeight: 1.4,
                                          color: '#424242'
                                        }}
                                      >
                                        {rec}
                                      </Typography>
                                    ))}
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}

                          {analysisResult.isEligible && Object.keys(analysisResult.recommendationTopics).length === 0 && (
                            <Box mb={2}>
                              <Typography variant="body2" sx={{ 
                                color: '#2e7d32',
                                fontStyle: 'italic',
                                textAlign: 'center',
                                p: 2,
                                backgroundColor: '#f1f8e9',
                                borderRadius: 1
                              }}>
                                ✅ Recurso elegível para otimização. Consulte o resumo abaixo para detalhes específicos.
                              </Typography>
                            </Box>
                          )}                          {!analysisResult.isEligible && analysisResult.ineligibilityReasons.length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" gutterBottom sx={{ 
                                fontWeight: 'bold', 
                                color: '#d32f2f',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}>
                                ❌ Razões da Inelegibilidade:
                              </Typography>
                              <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                                {analysisResult.ineligibilityReasons.map((reason, index) => (
                                  <Typography 
                                    component="li" 
                                    key={index} 
                                    variant="body2" 
                                    sx={{ 
                                      mb: 0.5, 
                                      color: '#d32f2f',
                                      fontSize: '0.85rem',
                                      lineHeight: 1.4
                                    }}
                                  >
                                    {reason}
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          )}{/* Resumo da análise */}
                          <Paper 
                            variant="outlined" 
                            sx={{ 
                              p: 2, 
                              backgroundColor: analysisResult.isEligible ? '#f1f8e9' : '#ffebee',
                              border: `1px solid ${analysisResult.isEligible ? '#4caf50' : '#f44336'}`,
                              borderRadius: 2,
                              maxHeight: 150,
                              overflow: 'auto'
                            }}
                          >
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 'bold', 
                                mb: 1,
                                color: analysisResult.isEligible ? '#2e7d32' : '#d32f2f',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}
                            >
                              📝 Resumo da Análise:
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: '0.8rem', 
                                lineHeight: 1.4,
                                color: '#424242'
                              }}
                            >
                              {analysisResult.summary}
                            </Typography>
                          </Paper>
                        </Box>
                      );
                    })()}
                  </Box>
                )}
                {!analysis && !analyzing && (
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    justifyContent="center" 
                    minHeight={200}
                    sx={{ color: 'text.secondary' }}
                  >
                    <Typography>Selecione um recurso e clique em "Analisar" para ver recomendações de otimização baseadas em IA</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {error && (
            <Box mt={3}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
        </Box>
      </Container>
    </>
  );
}

export default App;
