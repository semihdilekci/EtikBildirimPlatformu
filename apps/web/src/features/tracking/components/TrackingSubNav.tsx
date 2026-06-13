import { Tab, Tabs } from '@mui/material';
import { useNavigate } from 'react-router-dom';

type TrackingSubNavProps = {
  activeTab: 'status' | 'messages';
};

export function TrackingSubNav({ activeTab }: TrackingSubNavProps) {
  const navigate = useNavigate();

  return (
    <Tabs
      value={activeTab}
      onChange={(_, value: 'status' | 'messages') => {
        void navigate(value === 'status' ? '/tracking/status' : '/tracking/messages');
      }}
      variant="fullWidth"
      aria-label="Takip navigasyonu"
    >
      <Tab
        label="Durum"
        value="status"
        aria-current={activeTab === 'status' ? 'page' : undefined}
      />
      <Tab
        label="Mesajlar"
        value="messages"
        aria-current={activeTab === 'messages' ? 'page' : undefined}
      />
    </Tabs>
  );
}
