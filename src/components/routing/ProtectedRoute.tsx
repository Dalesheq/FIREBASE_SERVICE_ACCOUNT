import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { AccountDeactivated } from '../../pages/AccountDeactivated';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { firebaseUser, currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Verifying session..." subtext="Connecting to Firebase Authentication" />;
  }

  if (!firebaseUser) {
    return null; // Handled by App wrapper showing AuthPage
  }

  if (currentUser && !currentUser.active) {
    return <AccountDeactivated />;
  }

  return <>{children}</>;
};
