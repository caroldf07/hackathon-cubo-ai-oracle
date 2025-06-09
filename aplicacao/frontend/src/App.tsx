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
  application_tier: string;
  tier_justification: string;
  guardrail_status: string;
  motivos: string;
  efficiency_score: number;
  recommendations: string[];
  optimization_opportunities: string[];
  cost_impact: string;
}

interface Resource {
  resource_name: string;
  analysis: AnalysisResult;
  raw_response: string;
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
  };  const extractAnalysisContent = (analysisData: AnalysisResult) => {
    try {
      // O backend agora retorna diretamente o JSON estruturado
      const isApproved = analysisData.guardrail_status === "aprovado pelo guardrail";
      
      // Organizar recomendações por categorias
      const recommendationTopics: { [key: string]: string[] } = {
        'Geral': [],
        'Otimizações': []
      };

      // Categorizar recomendações gerais
      if (analysisData.recommendations && Array.isArray(analysisData.recommendations)) {
        recommendationTopics['Geral'] = analysisData.recommendations.slice(0, 5);
      }

      // Categorizar oportunidades de otimização
      if (analysisData.optimization_opportunities && Array.isArray(analysisData.optimization_opportunities)) {
        recommendationTopics['Otimizações'] = analysisData.optimization_opportunities.slice(0, 5);
      }

      // Filtrar tópicos vazios
      const filteredTopics: { [key: string]: string[] } = {};
      Object.entries(recommendationTopics).forEach(([topic, items]) => {
        if (items.length > 0) {
          filteredTopics[topic] = items;
        }
      });

      return {
        isApproved,
        recommendationTopics: filteredTopics,
        reasons: [analysisData.motivos],
        summary: analysisData.tier_justification,
        applicationTier: analysisData.application_tier,
        efficiencyScore: analysisData.efficiency_score,
        costImpact: analysisData.cost_impact,
        resourceName: analysisData.resource_name
      };

    } catch (error) {
      console.error('Error extracting analysis content:', error);
      return {
        isApproved: false,
        recommendationTopics: {},
        reasons: ['Erro ao processar análise: ' + error.message],
        summary: 'Erro ao processar análise',
        applicationTier: '',
        efficiencyScore: 0,
        costImpact: '',
        resourceName: ''
      };
    }  };

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
                    </Typography>                    {(() => {
                      const analysisResult = extractAnalysisContent(analysis.analysis);
                      return (
                        <Box mt={2}>
                          {/* Status de Conformidade com Guardrails */}
                          <Box 
                            display="flex" 
                            alignItems="center" 
                            gap={1} 
                            mb={2}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              backgroundColor: analysisResult.isApproved ? '#e8f5e8' : '#ffebee',
                              border: `2px solid ${analysisResult.isApproved ? '#4caf50' : '#f44336'}`
                            }}
                          >
                            <Box 
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                backgroundColor: analysisResult.isApproved ? '#4caf50' : '#f44336',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            >
                              {analysisResult.isApproved ? '✓' : '✗'}
                            </Box>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                color: analysisResult.isApproved ? '#2e7d32' : '#d32f2f',
                                fontWeight: 'bold',
                                fontSize: '1rem'
                              }}
                            >
                              {analysisResult.isApproved ? '✅ APROVADO PELO GUARDRAIL' : '❌ REPROVADO PELO GUARDRAIL'}
                            </Typography>
                          </Box>

                          {/* Informações do Tier da Aplicação */}
                          {analysisResult.applicationTier && (
                            <Box 
                              mb={2}
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: '#e3f2fd',
                                border: '1px solid #2196f3'
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
                                🏗️ Tier da Aplicação: {analysisResult.applicationTier}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontSize: '0.85rem',
                                  lineHeight: 1.4,
                                  color: '#424242'
                                }}
                              >
                                {analysisResult.summary}
                              </Typography>
                            </Box>
                          )}

                          {/* Score de Eficiência */}
                          {analysisResult.efficiencyScore > 0 && (
                            <Box 
                              mb={2}
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: analysisResult.efficiencyScore >= 90 ? '#e8f5e8' : '#fff3e0',
                                border: `1px solid ${analysisResult.efficiencyScore >= 90 ? '#4caf50' : '#ff9800'}`
                              }}
                            >
                              <Typography 
                                variant="subtitle2" 
                                gutterBottom 
                                sx={{ 
                                  fontWeight: 'bold', 
                                  color: analysisResult.efficiencyScore >= 90 ? '#2e7d32' : '#f57c00',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                📊 Score de Eficiência: {analysisResult.efficiencyScore}%
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontSize: '0.8rem',
                                  color: '#424242'
                                }}
                              >
                                {analysisResult.efficiencyScore >= 90 
                                  ? 'Recurso com alta eficiência operacional'
                                  : 'Recurso com oportunidades de otimização'
                                }
                              </Typography>
                            </Box>
                          )}

                          {/* Motivos da Aprovação/Reprovação */}
                          {analysisResult.reasons && analysisResult.reasons.length > 0 && (
                            <Box mb={2}>
                              <Typography 
                                variant="subtitle2" 
                                gutterBottom 
                                sx={{ 
                                  fontWeight: 'bold', 
                                  color: analysisResult.isApproved ? '#2e7d32' : '#d32f2f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                {analysisResult.isApproved ? '📋' : '⚠️'} 
                                {analysisResult.isApproved ? 'Motivos da Aprovação:' : 'Motivos da Reprovação:'}
                              </Typography>
                              <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                                {analysisResult.reasons.map((reason, index) => (
                                  <Typography 
                                    component="li" 
                                    key={index} 
                                    variant="body2" 
                                    sx={{ 
                                      mb: 0.5, 
                                      color: analysisResult.isApproved ? '#2e7d32' : '#d32f2f',
                                      fontSize: '0.85rem',
                                      lineHeight: 1.4
                                    }}
                                  >
                                    {reason}
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* Recomendações e Oportunidades de Otimização */}
                          {Object.keys(analysisResult.recommendationTopics).length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                                💡 Recomendações:
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
                                    {topic === 'Geral' && '📋'}
                                    {topic === 'Otimizações' && '⚡'}
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

                          {/* Impacto de Custo */}
                          {analysisResult.costImpact && (
                            <Paper 
                              variant="outlined" 
                              sx={{ 
                                p: 2, 
                                backgroundColor: '#f3e5f5',
                                border: '1px solid #9c27b0',
                                borderRadius: 2
                              }}
                            >
                              <Typography 
                                variant="subtitle2" 
                                sx={{ 
                                  fontWeight: 'bold', 
                                  mb: 1,
                                  color: '#7b1fa2',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                💰 Impacto Financeiro:
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontSize: '0.85rem', 
                                  lineHeight: 1.4,
                                  color: '#424242'
                                }}
                              >
                                {analysisResult.costImpact}
                              </Typography>
                            </Paper>
                          )}
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
