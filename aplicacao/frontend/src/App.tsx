import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  AppBar,
  Toolbar,
} from '@mui/material';
import axios from 'axios';

interface Resource {
  resource_id: string;
  analysis: any;
  raw_data: {
    datadog: any[];
    finops: any[];
  };
}

function App() {
  const [resources, setResources] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, Resource>>({});
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const analyzeResources = async () => {
      for (const resourceId of resources) {
        try {
          const response = await axios.post('http://localhost:8000/analyze_resource', {
            resource_id: resourceId
          });
          setAnalyses(prev => ({
            ...prev,
            [resourceId]: response.data
          }));
        } catch (err) {
          console.error(`Error analyzing resource ${resourceId}:`, err);
        }
      }
    };

    if (resources.length > 0) {
      analyzeResources();
    }
  }, [resources]);

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
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">
            Resource Analyzer Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg">
        <Box py={4}>
          <Grid container spacing={3}>
            {resources.map((resourceId) => (
              <Grid item xs={12} md={6} key={resourceId}>
                <Paper elevation={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Resource ID: {resourceId}
                      </Typography>
                      {analyses[resourceId] ? (
                        <Box>
                          <Typography variant="body1" color="textSecondary">
                            Analysis Result:
                          </Typography>
                          <Box mt={1}>
                            <pre style={{ 
                              whiteSpace: 'pre-wrap', 
                              wordBreak: 'break-word',
                              backgroundColor: '#f5f5f5',
                              padding: '1rem',
                              borderRadius: '4px'
                            }}>
                              {JSON.stringify(analyses[resourceId].analysis, null, 2)}
                            </pre>
                          </Box>
                        </Box>
                      ) : (
                        <Box display="flex" alignItems="center" gap={1}>
                          <CircularProgress size={20} />
                          <Typography>Analyzing...</Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </>
  );
}

export default App;
