import React from 'react';
import ForgeReconciler, { Box, Heading, Stack, Tab, TabList, TabPanel, Tabs, Text } from '@forge/react';
import { DecisionsTab } from './home/DecisionsTab';
import { InboxTab } from './home/InboxTab';
import { MapTab } from './home/MapTab';
import { SettingsTab } from './home/SettingsTab';

const App = () => (
  <Stack space="space.300">
    <Stack space="space.050">
      <Heading size="large">Precedent</Heading>
      <Text color="color.text.subtle">Your team's case law, enforced for people and AI agents.</Text>
    </Stack>
    <Tabs id="precedent-tabs">
      <TabList>
        <Tab>Map</Tab>
        <Tab>Inbox</Tab>
        <Tab>Decisions</Tab>
        <Tab>Settings</Tab>
      </TabList>
      <TabPanel>
        <Box paddingBlock="space.200">
          <MapTab />
        </Box>
      </TabPanel>
      <TabPanel>
        <Box paddingBlock="space.200">
          <InboxTab />
        </Box>
      </TabPanel>
      <TabPanel>
        <Box paddingBlock="space.200">
          <DecisionsTab />
        </Box>
      </TabPanel>
      <TabPanel>
        <Box paddingBlock="space.200">
          <SettingsTab />
        </Box>
      </TabPanel>
    </Tabs>
  </Stack>
);

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
