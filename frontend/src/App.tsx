import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { RiskMapPage } from './pages/RiskMapPage';
import { AiPredictionPage } from './pages/AiPredictionPage';
import { AlertsPage } from './pages/AlertsPage';
import { FieldReportsPage } from './pages/FieldReportsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { checkBackendHealth, getBackendInfo } from './services/api';
import { ConnectionState, HealthResponse, InfoResponse, NavSectionId } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavSectionId>('overview');
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [infoData, setInfoData] = useState<InfoResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const performHealthCheck = useCallback(async () => {
    setConnectionState('loading');
    setErrorMessage(null);

    try {
      const [health, info] = await Promise.all([
        checkBackendHealth(),
        getBackendInfo().catch(() => null),
      ]);

      setHealthData(health);
      setInfoData(info);
      setConnectionState('success');
      setLastChecked(new Date());
    } catch (err: unknown) {
      setConnectionState('error');
      setHealthData(null);
      setInfoData(null);
      setLastChecked(new Date());

      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to connect to backend server. Verify FastAPI is running on port 8000.');
      }
    }
  }, []);

  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      connectionState={connectionState}
    >
      {currentTab === 'overview' ? (
        <OverviewPage
          connectionState={connectionState}
          healthData={healthData}
          infoData={infoData}
          errorMessage={errorMessage}
          lastChecked={lastChecked}
          onRefreshHealth={performHealthCheck}
          onNavigateToMap={() => setCurrentTab('risk-map')}
          onNavigateToAiPrediction={() => setCurrentTab('ai-prediction')}
          onNavigateToAlerts={() => setCurrentTab('alerts')}
          onNavigateToFieldReports={() => setCurrentTab('field-reports')}
        />
      ) : currentTab === 'risk-map' ? (
        <RiskMapPage
          onReturnToOverview={() => setCurrentTab('overview')}
          onNavigateToAi={() => setCurrentTab('ai-prediction')}
        />
      ) : currentTab === 'ai-prediction' ? (
        <AiPredictionPage
          onReturnToOverview={() => setCurrentTab('overview')}
          onNavigateToAlerts={() => setCurrentTab('alerts')}
        />
      ) : currentTab === 'field-reports' ? (
        <FieldReportsPage
          onReturnToOverview={() => setCurrentTab('overview')}
          onNavigateToRiskMap={() => setCurrentTab('risk-map')}
        />
      ) : currentTab === 'alerts' ? (
        <AlertsPage
          onReturnToOverview={() => setCurrentTab('overview')}
          onNavigateToRiskMap={() => setCurrentTab('risk-map')}
        />
      ) : (
        <PlaceholderPage
          sectionId={currentTab}
          onReturnToOverview={() => setCurrentTab('overview')}
        />
      )}
    </AppLayout>
  );
};

export default App;

