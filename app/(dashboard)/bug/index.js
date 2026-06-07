import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import ChatInterface from '@/components/ChatInterface';
import DashboardShell, { useDashboard } from '@/components/layout/DashboardShell';

// Inner body so it can consume the dashboard context (rendered inside the shell).
function ChatBody({ currentSessionId, chatKey }) {
  const { reloadSessions } = useDashboard();

  return (
    <ChatInterface
      key={chatKey}
      sessionId={currentSessionId}
      onChatUpdated={(id) => {
        if (id && id !== currentSessionId) {
          // Promote this new chat to an addressable session and refresh the sidebar.
          router.setParams({ session: id, new: undefined });
        }
        reloadSessions();
      }}
    />
  );
}

export default function ChatPage() {
  const params = useLocalSearchParams();
  const currentSessionId = params.session || null;
  // Key forces a fresh ChatInterface for a new chat (param `new` is a nonce).
  const chatKey = params.session || params.new || 'new';

  return (
    <DashboardShell currentSessionId={currentSessionId}>
      <ChatBody currentSessionId={currentSessionId} chatKey={chatKey} />
    </DashboardShell>
  );
}
